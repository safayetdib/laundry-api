import { Schema, model, type HydratedDocument } from 'mongoose';
import { HANDOVER_TYPES, type HandoverEvent } from './handover.types';
import type { HandoverRepository, RecordHandoverData } from './handover.repository';

type HandoverDoc = Omit<HandoverEvent, 'id'>;

const countSchema = new Schema(
  { orderItemId: { type: String, required: true }, quantity: { type: Number, required: true } },
  { _id: false },
);

const discrepancySchema = new Schema(
  {
    orderItemId: { type: String, required: true },
    expected: { type: Number, required: true },
    received: { type: Number, required: true },
    note: { type: String },
  },
  { _id: false },
);

const handoverSchema = new Schema<HandoverDoc>({
  orderId: { type: String, required: true, index: true },
  assignmentId: { type: String },
  deliveryTaskId: { type: String },
  type: { type: String, enum: HANDOVER_TYPES, required: true },
  actorId: { type: String, required: true },
  fromParty: { type: String },
  toParty: { type: String },
  counts: { type: [countSchema], default: [] },
  discrepancies: { type: [discrepancySchema], default: [] },
  conditionNotes: { type: String },
  evidenceKeys: { type: [String], default: [] },
  scanAssisted: { type: Boolean, required: true, default: false },
  requestId: { type: String },
  occurredAt: { type: Date, required: true },
  recordedAt: { type: Date, required: true, index: true },
});

const HandoverModel = model<HandoverDoc>('HandoverEvent', handoverSchema);

function toEvent(doc: HydratedDocument<HandoverDoc>): HandoverEvent {
  const obj = doc.toObject();
  return { id: doc.id, ...obj } as unknown as HandoverEvent;
}

export class MongoHandoverRepository implements HandoverRepository {
  async append(data: RecordHandoverData): Promise<HandoverEvent> {
    const now = new Date();
    const doc = await HandoverModel.create({
      ...data,
      discrepancies: data.discrepancies ?? [],
      evidenceKeys: data.evidenceKeys ?? [],
      scanAssisted: data.scanAssisted ?? false,
      occurredAt: data.occurredAt ?? now,
      recordedAt: now,
    });
    return toEvent(doc);
  }

  async listByOrder(orderId: string): Promise<HandoverEvent[]> {
    const docs = await HandoverModel.find({ orderId }).sort({ recordedAt: 1 });
    return docs.map(toEvent);
  }
}

export { HandoverModel };
