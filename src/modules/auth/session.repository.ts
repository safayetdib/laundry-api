import { createHash, randomBytes, randomUUID } from 'node:crypto';

export interface Session {
  id: string;
  userId: string;
  /** SHA-256 of the opaque session token; the raw token lives only in the cookie. */
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface SessionRepository {
  create(input: CreateSessionInput): Promise<Session>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

/** Generates a high-entropy opaque session token for the cookie. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hashes a session token for storage/lookup. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** In-memory repository for tests and local development without a database. */
export class InMemorySessionRepository implements SessionRepository {
  private readonly byId = new Map<string, Session>();

  async create(input: CreateSessionInput): Promise<Session> {
    const session: Session = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
    };
    this.byId.set(session.id, session);
    return session;
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    for (const session of this.byId.values()) {
      if (session.tokenHash === tokenHash) return session;
    }
    return null;
  }

  async revoke(id: string): Promise<void> {
    const session = this.byId.get(id);
    if (session && !session.revokedAt) {
      session.revokedAt = new Date();
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const session of this.byId.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = new Date();
      }
    }
  }
}
