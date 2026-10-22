import { Schema, model, type HydratedDocument } from 'mongoose';
import type { CreateSessionInput, Session, SessionRepository } from './session.repository';

interface SessionDoc {
  userId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
}

const sessionSchema = new Schema<SessionDoc>({
  userId: { type: String, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, required: true, default: () => new Date() },
  // TTL index: expired sessions are removed automatically by MongoDB.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: { type: Date },
});

const SessionModel = model<SessionDoc>('Session', sessionSchema);

function toSession(doc: HydratedDocument<SessionDoc>): Session {
  return {
    id: doc.id,
    userId: doc.userId,
    tokenHash: doc.tokenHash,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
    ...(doc.revokedAt ? { revokedAt: doc.revokedAt } : {}),
  };
}

export class MongoSessionRepository implements SessionRepository {
  async create(input: CreateSessionInput): Promise<Session> {
    const doc = await SessionModel.create(input);
    return toSession(doc);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const doc = await SessionModel.findOne({ tokenHash });
    return doc ? toSession(doc) : null;
  }

  async revoke(id: string): Promise<void> {
    await SessionModel.updateOne(
      { _id: id, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await SessionModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );
  }
}

export { SessionModel };
