import { Schema, model, type HydratedDocument } from 'mongoose';
import { ConflictError } from '../../lib/errors';
import {
  PAYMENT_ENTRY_STATUSES,
  PAYMENT_ENTRY_TYPES,
  PAYMENT_METHODS,
  type PaymentEntry,
} from './payment.types';
import type { CreatePaymentEntryData, PaymentRepository } from './payment.repository';

type PaymentDoc = Omit<PaymentEntry, 'id'>;

const paymentSchema = new Schema<PaymentDoc>({
  orderId: { type: String, required: true, index: true },
  method: { type: String, enum: PAYMENT_METHODS, required: true },
  type: { type: String, enum: PAYMENT_ENTRY_TYPES, required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, required: true },
  status: { type: String, enum: PAYMENT_ENTRY_STATUSES, required: true, index: true },
  reference: { type: String },
  expectedAmount: { type: Number },
  recordedBy: { type: String, required: true },
  verifiedBy: { type: String },
  createdAt: { type: Date, required: true, default: () => new Date() },
  verifiedAt: { type: Date },
});

const PaymentModel = model<PaymentDoc>('Payment', paymentSchema);

function toEntry(doc: HydratedDocument<PaymentDoc>): PaymentEntry {
  const obj = doc.toObject();
  return { id: doc.id, ...obj } as unknown as PaymentEntry;
}

export class MongoPaymentRepository implements PaymentRepository {
  async create(data: CreatePaymentEntryData): Promise<PaymentEntry> {
    const doc = await PaymentModel.create({ ...data, createdAt: new Date() });
    return toEntry(doc);
  }

  async findById(id: string): Promise<PaymentEntry | null> {
    const doc = await PaymentModel.findById(id);
    return doc ? toEntry(doc) : null;
  }

  async listByOrder(orderId: string): Promise<PaymentEntry[]> {
    const docs = await PaymentModel.find({ orderId }).sort({ createdAt: 1 });
    return docs.map(toEntry);
  }

  async resolvePending(
    id: string,
    status: 'verified' | 'rejected',
    verifiedBy: string,
    verifiedAt: Date,
  ): Promise<PaymentEntry> {
    const doc = await PaymentModel.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { $set: { status, verifiedBy, verifiedAt } },
      { new: true },
    );
    if (!doc) throw new ConflictError('Only a pending payment entry can be resolved.');
    return toEntry(doc);
  }
}

export { PaymentModel };
