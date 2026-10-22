import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { UnauthorizedError, ValidationError } from '../../lib/errors';
import { normalizeBdPhone } from '../../lib/phone';
import type { User } from '../users/user.types';
import type { UserRepository } from '../users/user.repository';
import type { AuthService } from './auth.service';
import type { OtpRepository } from './otp.repository';
import type { SmsSender } from './sms';

const CODE_LENGTH = 6;
const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export interface OtpServiceDeps {
  users: UserRepository;
  otps: OtpRepository;
  sms: SmsSender;
  auth: AuthService;
  now?: () => Date;
  generateCode?: () => string;
}

function hashCode(phone: string, code: string): string {
  return createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export class OtpService {
  private readonly now: () => Date;
  private readonly generateCode: () => string;

  constructor(private readonly deps: OtpServiceDeps) {
    this.now = deps.now ?? (() => new Date());
    this.generateCode =
      deps.generateCode ?? (() => String(randomInt(0, 1_000_000)).padStart(CODE_LENGTH, '0'));
  }

  /** Issues an OTP and sends it via SMS. The code is never returned or logged. */
  async requestOtp(phoneInput: string): Promise<void> {
    const phone = normalizeBdPhone(phoneInput);
    if (!phone) throw new ValidationError('A valid Bangladesh mobile number is required.');

    const code = this.generateCode();
    await this.deps.otps.create({
      phone,
      codeHash: hashCode(phone, code),
      expiresAt: new Date(this.now().getTime() + TTL_MS),
    });
    await this.deps.sms.send(
      phone,
      `Your Folded verification code is ${code}. It expires in 5 minutes.`,
    );
  }

  /** Verifies an OTP and starts a session, creating a customer on first login. */
  async verifyOtp(phoneInput: string, code: string): Promise<{ user: User; token: string }> {
    const phone = normalizeBdPhone(phoneInput);
    const invalid = new UnauthorizedError('Invalid or expired code.');
    if (!phone) throw invalid;

    const challenge = await this.deps.otps.findActiveByPhone(phone, this.now());
    if (!challenge) throw invalid;
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new UnauthorizedError('Too many attempts. Request a new code.');
    }

    if (!safeEqualHex(challenge.codeHash, hashCode(phone, code))) {
      await this.deps.otps.incrementAttempts(challenge.id);
      throw invalid;
    }
    await this.deps.otps.consume(challenge.id);

    let user = await this.deps.users.findByPhone(phone);
    if (!user) {
      // First-time OTP login: create a passwordless-in-practice customer.
      user = await this.deps.auth.createUser({
        name: 'Customer',
        phone,
        password: randomBytes(24).toString('hex'),
        roles: ['customer'],
      });
    }
    return this.deps.auth.startSessionForUser(user);
  }
}
