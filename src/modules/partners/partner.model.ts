import { Schema, model, type HydratedDocument } from 'mongoose';
import { PARTNER_STATUSES, type Partner, type PartnerStatus } from './partner.types';
import type { CreatePartnerInput, PartnerRepository } from './partner.repository';

interface PartnerDoc {
  code: string;
  name: string;
  status: PartnerStatus;
  serviceCodes: string[];
  zoneIds: string[];
  contact: { phone?: string; email?: string };
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<PartnerDoc>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    status: { type: String, enum: PARTNER_STATUSES, required: true, default: 'active' },
    serviceCodes: { type: [String], default: [] },
    zoneIds: { type: [String], default: [] },
    contact: { type: { phone: String, email: String }, default: {} },
  },
  { timestamps: true },
);

const PartnerModel = model<PartnerDoc>('Partner', partnerSchema);

function toPartner(doc: HydratedDocument<PartnerDoc>): Partner {
  return {
    id: doc.id,
    code: doc.code,
    name: doc.name,
    status: doc.status,
    serviceCodes: doc.serviceCodes,
    zoneIds: doc.zoneIds,
    contact: doc.contact ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export class MongoPartnerRepository implements PartnerRepository {
  async listAll(): Promise<Partner[]> {
    const docs = await PartnerModel.find().sort({ code: 1 });
    return docs.map(toPartner);
  }

  async findById(id: string): Promise<Partner | null> {
    const doc = await PartnerModel.findById(id);
    return doc ? toPartner(doc) : null;
  }

  async findByCode(code: string): Promise<Partner | null> {
    const doc = await PartnerModel.findOne({ code });
    return doc ? toPartner(doc) : null;
  }

  async create(input: CreatePartnerInput): Promise<Partner> {
    try {
      const doc = await PartnerModel.create(input);
      return toPartner(doc);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new Error('DUPLICATE_CODE');
      throw err;
    }
  }
}

export { PartnerModel };
