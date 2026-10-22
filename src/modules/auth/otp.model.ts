import { Schema, model, type HydratedDocument } from 'mongoose';
import type { CreateOtpInput, OtpChallenge, OtpRepository } from './otp.repository';

interface OtpDoc {
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date;
  createdAt: Date;
}

const otpSchema = new Schema<OtpDoc>({
  phone: { type: String, required: true, index: true },
  codeHash: { type: String, required: true },
  // TTL index removes challenges shortly after they expire.
  expiresAt: { type: Date, required: true, index: { expires: 300 } },
  attempts: { type: Number, required: true, default: 0 },
  consumedAt: { type: Date },
  createdAt: { type: Date, required: true, default: () => new Date() },
});

const OtpModel = model<OtpDoc>('OtpChallenge', otpSchema);

function toChallenge(doc: HydratedDocument<OtpDoc>): OtpChallenge {
  return {
    id: doc.id,
    phone: doc.phone,
    codeHash: doc.codeHash,
    expiresAt: doc.expiresAt,
    attempts: doc.attempts,
    ...(doc.consumedAt ? { consumedAt: doc.consumedAt } : {}),
    createdAt: doc.createdAt,
  };
}

export class MongoOtpRepository implements OtpRepository {
  async create(input: CreateOtpInput): Promise<OtpChallenge> {
    const doc = await OtpModel.create(input);
    return toChallenge(doc);
  }

  async findActiveByPhone(phone: string, now: Date): Promise<OtpChallenge | null> {
    const doc = await OtpModel.findOne({
      phone,
      consumedAt: { $exists: false },
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 });
    return doc ? toChallenge(doc) : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    await OtpModel.updateOne({ _id: id }, { $inc: { attempts: 1 } });
  }

  async consume(id: string): Promise<void> {
    await OtpModel.updateOne({ _id: id }, { $set: { consumedAt: new Date() } });
  }
}

export { OtpModel };
