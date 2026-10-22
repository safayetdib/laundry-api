import { Schema, model, type HydratedDocument } from 'mongoose';
import { ConflictError } from '../../lib/errors';
import { DELIVERY_TASK_STATUSES, DELIVERY_TASK_TYPES, type DeliveryTask } from './delivery.types';
import type {
  CreateDeliveryTaskData,
  DeliveryTaskChanges,
  DeliveryTaskRepository,
} from './delivery.repository';

type DeliveryTaskDoc = Omit<DeliveryTask, 'id'>;

const schema = new Schema<DeliveryTaskDoc>({
  orderId: { type: String, required: true, index: true },
  type: { type: String, enum: DELIVERY_TASK_TYPES, required: true },
  riderId: { type: String, index: true },
  manifestId: { type: String, index: true },
  status: { type: String, enum: DELIVERY_TASK_STATUSES, required: true },
  scheduledStart: { type: String, required: true },
  scheduledEnd: { type: String, required: true },
  attempts: { type: Number, required: true, default: 0 },
  failureReason: { type: String },
  evidenceKeys: { type: [String], default: [] },
  codAmountCollected: { type: Number },
  version: { type: Number, required: true, default: 1 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  completedAt: { type: Date },
});

const DeliveryTaskModel = model<DeliveryTaskDoc>('DeliveryTask', schema);

function toTask(doc: HydratedDocument<DeliveryTaskDoc>): DeliveryTask {
  const obj = doc.toObject();
  return { id: doc.id, ...obj } as unknown as DeliveryTask;
}

export class MongoDeliveryTaskRepository implements DeliveryTaskRepository {
  async create(data: CreateDeliveryTaskData): Promise<DeliveryTask> {
    const now = new Date();
    const doc = await DeliveryTaskModel.create({
      ...data,
      status: 'scheduled',
      attempts: 0,
      evidenceKeys: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return toTask(doc);
  }

  async findById(id: string): Promise<DeliveryTask | null> {
    const doc = await DeliveryTaskModel.findById(id);
    return doc ? toTask(doc) : null;
  }

  async listByOrder(orderId: string): Promise<DeliveryTask[]> {
    const docs = await DeliveryTaskModel.find({ orderId });
    return docs.map(toTask);
  }

  async listByRider(riderId: string): Promise<DeliveryTask[]> {
    const docs = await DeliveryTaskModel.find({ riderId }).sort({ scheduledStart: 1 });
    return docs.map(toTask);
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: DeliveryTaskChanges,
  ): Promise<DeliveryTask> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(changes)) {
      if (v !== undefined) set[k] = v;
    }
    const doc = await DeliveryTaskModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: set, $inc: { version: 1 } },
      { new: true },
    );
    if (!doc) throw new ConflictError('The delivery task has changed. Refresh and try again.');
    return toTask(doc);
  }
}

export { DeliveryTaskModel };
