import { Schema, model, type HydratedDocument } from 'mongoose';
import { ConflictError } from '../../lib/errors';
import {
  MANIFEST_STATUSES,
  ROUTE_STOP_STATUSES,
  ROUTE_STOP_TYPES,
  type RouteManifest,
} from './manifest.types';
import type {
  CreateManifestData,
  ManifestChanges,
  ManifestRepository,
} from './manifest.repository';

type ManifestDoc = Omit<RouteManifest, 'id'>;

const stopSchema = new Schema(
  {
    id: { type: String, required: true },
    sequence: { type: Number, required: true },
    type: { type: String, enum: ROUTE_STOP_TYPES, required: true },
    orderId: { type: String },
    deliveryTaskId: { type: String },
    status: { type: String, enum: ROUTE_STOP_STATUSES, required: true, default: 'pending' },
    failureReason: { type: String },
  },
  { _id: false },
);

const manifestSchema = new Schema<ManifestDoc>({
  date: { type: String, required: true, index: true },
  riderId: { type: String, index: true },
  status: { type: String, enum: MANIFEST_STATUSES, required: true, default: 'draft' },
  notes: { type: String },
  vehicleCapacity: { type: Number },
  stops: { type: [stopSchema], default: [] },
  version: { type: Number, required: true, default: 1 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
});

const ManifestModel = model<ManifestDoc>('RouteManifest', manifestSchema);

function toManifest(doc: HydratedDocument<ManifestDoc>): RouteManifest {
  const obj = doc.toObject();
  return { id: doc.id, ...obj } as unknown as RouteManifest;
}

export class MongoManifestRepository implements ManifestRepository {
  async create(data: CreateManifestData): Promise<RouteManifest> {
    const now = new Date();
    const doc = await ManifestModel.create({
      ...data,
      status: 'draft',
      stops: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return toManifest(doc);
  }

  async findById(id: string): Promise<RouteManifest | null> {
    const doc = await ManifestModel.findById(id);
    return doc ? toManifest(doc) : null;
  }

  async listByRider(riderId: string): Promise<RouteManifest[]> {
    const docs = await ManifestModel.find({ riderId }).sort({ date: 1 });
    return docs.map(toManifest);
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: ManifestChanges,
  ): Promise<RouteManifest> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    for (const [k, v] of Object.entries(changes)) {
      if (v !== undefined) set[k] = v;
    }
    const doc = await ManifestModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: set, $inc: { version: 1 } },
      { new: true },
    );
    if (!doc) throw new ConflictError('The manifest has changed. Refresh and try again.');
    return toManifest(doc);
  }
}

export { ManifestModel };
