import { Schema, model, type HydratedDocument } from 'mongoose';
import { SLOT_TYPES, type ServiceZone, type SlotTemplate } from './zone.types';
import type { CreateZoneInput, ZoneRepository } from './zone.repository';

interface ZoneDoc {
  code: string;
  name: string;
  city: string;
  active: boolean;
  localities: string[];
  slotTemplates: SlotTemplate[];
  createdAt: Date;
  updatedAt: Date;
}

const slotTemplateSchema = new Schema<SlotTemplate>(
  {
    type: { type: String, enum: SLOT_TYPES, required: true },
    label: { type: String, required: true },
    startHour: { type: Number, required: true, min: 0, max: 24 },
    endHour: { type: Number, required: true, min: 0, max: 24 },
    capacity: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const zoneSchema = new Schema<ZoneDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    city: { type: String, required: true },
    active: { type: Boolean, required: true, default: true },
    localities: { type: [String], default: [] },
    slotTemplates: { type: [slotTemplateSchema], default: [] },
  },
  { timestamps: true },
);

const ZoneModel = model<ZoneDoc>('ServiceZone', zoneSchema);

function toZone(doc: HydratedDocument<ZoneDoc>): ServiceZone {
  return {
    id: doc.id,
    code: doc.code,
    name: doc.name,
    city: doc.city,
    active: doc.active,
    localities: doc.localities,
    slotTemplates: doc.slotTemplates,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoZoneRepository implements ZoneRepository {
  async listActive(): Promise<ServiceZone[]> {
    const docs = await ZoneModel.find({ active: true }).sort({ code: 1 });
    return docs.map(toZone);
  }

  async findById(id: string): Promise<ServiceZone | null> {
    const doc = await ZoneModel.findById(id);
    return doc ? toZone(doc) : null;
  }

  async findByCode(code: string): Promise<ServiceZone | null> {
    const doc = await ZoneModel.findOne({ code });
    return doc ? toZone(doc) : null;
  }

  async create(input: CreateZoneInput): Promise<ServiceZone> {
    const doc = await ZoneModel.create(input);
    return toZone(doc);
  }
}

export { ZoneModel };
