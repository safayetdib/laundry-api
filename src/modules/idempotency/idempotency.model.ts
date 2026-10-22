import { Schema, model, type HydratedDocument } from 'mongoose';
import type {
  IdempotencyRecord,
  IdempotencyRepository,
  SaveIdempotencyInput,
} from './idempotency.repository';

interface IdempotencyDoc {
  scope: string;
  key: string;
  requestHash: string;
  responseData: unknown;
  createdAt: Date;
}

const idempotencySchema = new Schema<IdempotencyDoc>({
  scope: { type: String, required: true },
  key: { type: String, required: true },
  requestHash: { type: String, required: true },
  responseData: { type: Schema.Types.Mixed },
  // Expire stored outcomes after 24h.
  createdAt: { type: Date, required: true, default: () => new Date(), index: { expires: 86_400 } },
});
idempotencySchema.index({ scope: 1, key: 1 }, { unique: true });

const IdempotencyModel = model<IdempotencyDoc>('IdempotencyRecord', idempotencySchema);

function toRecord(doc: HydratedDocument<IdempotencyDoc>): IdempotencyRecord {
  return {
    scope: doc.scope,
    key: doc.key,
    requestHash: doc.requestHash,
    responseData: doc.responseData,
    createdAt: doc.createdAt,
  };
}

export class MongoIdempotencyRepository implements IdempotencyRepository {
  async find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    const doc = await IdempotencyModel.findOne({ scope, key });
    return doc ? toRecord(doc) : null;
  }

  async save(input: SaveIdempotencyInput): Promise<void> {
    await IdempotencyModel.updateOne(
      { scope: input.scope, key: input.key },
      { $setOnInsert: { ...input, createdAt: new Date() } },
      { upsert: true },
    );
  }
}

export { IdempotencyModel };
