import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from '../../lib/errors';
import { normalizeBdPhone } from '../../lib/phone';
import type { Role, User, UserStatus } from '../users/user.types';
import type { UserRepository } from '../users/user.repository';
import { hashPassword, verifyPassword } from './password';
import {
  generateSessionToken,
  hashSessionToken,
  type Session,
  type SessionRepository,
} from './session.repository';

export interface AuthServiceDeps {
  users: UserRepository;
  sessions: SessionRepository;
  sessionTtlMs: number;
  now?: () => Date;
  generateToken?: () => string;
}

export interface CreateUserInput {
  name: string;
  phone: string;
  password: string;
  roles?: Role[];
  status?: UserStatus;
  partnerId?: string;
}

export class AuthService {
  private readonly now: () => Date;
  private readonly generateToken: () => string;

  constructor(private readonly deps: AuthServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.generateToken = deps.generateToken ?? generateSessionToken;
  }

  /** Creates a user (used by seeds, admin flows and tests). */
  async createUser(input: CreateUserInput): Promise<User> {
    const phone = normalizeBdPhone(input.phone);
    if (!phone) {
      throw new ValidationError('A valid Bangladesh mobile number is required.');
    }
    const roles = input.roles ?? ['customer'];
    if (roles.includes('partner_staff') && !input.partnerId) {
      throw new ValidationError('partner_staff users require a partnerId.');
    }

    const passwordHash = await hashPassword(input.password);
    try {
      return await this.deps.users.create({
        name: input.name,
        phone,
        passwordHash,
        roles,
        status: input.status ?? 'active',
        ...(input.partnerId ? { partnerId: input.partnerId } : {}),
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'DUPLICATE_PHONE') {
        throw new ConflictError('An account with this phone number already exists.');
      }
      throw err;
    }
  }

  /** Verifies credentials and creates a session. Returns the raw token. */
  async login(phoneInput: string, password: string): Promise<{ user: User; token: string }> {
    const phone = normalizeBdPhone(phoneInput);
    // Uniform failure to avoid revealing which part was wrong (no enumeration).
    const invalid = new UnauthorizedError('Invalid phone number or password.');
    if (!phone) throw invalid;

    const user = await this.deps.users.findByPhone(phone);
    if (!user) throw invalid;

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw invalid;

    return this.startSessionForUser(user);
  }

  /**
   * Issues a session for an already-authenticated user (used by password login
   * and by OTP login after the code is verified). Rejects a suspended account.
   */
  async startSessionForUser(user: User): Promise<{ user: User; token: string }> {
    if (user.status !== 'active') {
      throw new ForbiddenError('This account is suspended.');
    }
    const token = this.generateToken();
    await this.deps.sessions.create({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(this.now().getTime() + this.deps.sessionTtlMs),
    });
    return { user, token };
  }

  /** Resolves an active session + its user, or null if invalid/expired/revoked. */
  async validateSession(token: string): Promise<{ user: User; session: Session } | null> {
    const session = await this.deps.sessions.findByTokenHash(hashSessionToken(token));
    if (!session || session.revokedAt) return null;
    if (session.expiresAt.getTime() <= this.now().getTime()) return null;

    const user = await this.deps.users.findById(session.userId);
    if (!user) return null;

    return { user, session };
  }

  /** Revokes the session backing the given token, if any. */
  async logout(token: string): Promise<void> {
    const session = await this.deps.sessions.findByTokenHash(hashSessionToken(token));
    if (session && !session.revokedAt) {
      await this.deps.sessions.revoke(session.id);
    }
  }
}
