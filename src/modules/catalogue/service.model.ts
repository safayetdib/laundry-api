import { Schema, model, type HydratedDocument } from 'mongoose';
import { PRICING_UNITS, type PricingUnit, type Service } from './service.types';
import type { CreateServiceInput, ServiceRepository } from './service.repository';

interface ServiceDoc {
  code: string;
  name: string;
  description?: string;
  pricingUnit: PricingUnit;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<ServiceDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    pricingUnit: { type: String, enum: PRICING_UNITS, required: true },
    active: { type: Boolean, required: true, default: true },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

const ServiceModel = model<ServiceDoc>('Service', serviceSchema);

function toService(doc: HydratedDocument<ServiceDoc>): Service {
  return {
    id: doc.id,
    code: doc.code,
    name: doc.name,
    ...(doc.description ? { description: doc.description } : {}),
    pricingUnit: doc.pricingUnit,
    active: doc.active,
    sortOrder: doc.sortOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoServiceRepository implements ServiceRepository {
  async listActive(): Promise<Service[]> {
    const docs = await ServiceModel.find({ active: true }).sort({ sortOrder: 1, code: 1 });
    return docs.map(toService);
  }

  async findByCode(code: string): Promise<Service | null> {
    const doc = await ServiceModel.findOne({ code });
    return doc ? toService(doc) : null;
  }

  async create(input: CreateServiceInput): Promise<Service> {
    const doc = await ServiceModel.create(input);
    return toService(doc);
  }
}

export { ServiceModel };
