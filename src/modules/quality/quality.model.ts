import { Schema, model, type HydratedDocument } from 'mongoose';
import { ConflictError } from '../../lib/errors';
import { QUALITY_STATUSES, QUALITY_TYPES, type QualityCase } from './quality.types';
import type {
  CreateQualityCaseData,
  QualityCaseChanges,
  QualityCaseRepository,
} from './quality.repository';

type QualityDoc = Omit<QualityCase, 'id'>;

const schema = new Schema<QualityDoc>(
  {
    orderId: { type: String, required: true, index: true },
    type: { type: String, enum: QUALITY_TYPES, required: true },
    status: { type: String, enum: QUALITY_STATUSES, required: true, default: 'open', index: true },
    description: { type: String, required: true },
    evidenceKeys: { type: [String], default: [] },
    resolution: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

const QualityCaseModel = model<QualityDoc>('QualityCase', schema);

function toCase(doc: HydratedDocument<QualityDoc>): QualityCase {
  const obj = doc.toObject();
  return { id: doc.id, ...obj } as unknown as QualityCase;
}

export class MongoQualityCaseRepository implements QualityCaseRepository {
  async create(data: CreateQualityCaseData): Promise<QualityCase> {
    const doc = await QualityCaseModel.create({ ...data, status: 'open' });
    return toCase(doc);
  }

  async findById(id: string): Promise<QualityCase | null> {
    const doc = await QualityCaseModel.findById(id);
    return doc ? toCase(doc) : null;
  }

  async listByOrder(orderId: string): Promise<QualityCase[]> {
    const docs = await QualityCaseModel.find({ orderId }).sort({ createdAt: 1 });
    return docs.map(toCase);
  }

  async update(id: string, changes: QualityCaseChanges): Promise<QualityCase> {
    const doc = await QualityCaseModel.findByIdAndUpdate(id, { $set: changes }, { new: true });
    if (!doc) throw new ConflictError('Quality case not found.');
    return toCase(doc);
  }
}

export { QualityCaseModel };
