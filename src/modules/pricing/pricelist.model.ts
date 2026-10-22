import { Schema, model, type HydratedDocument } from 'mongoose';
import { CURRENCY } from '../../lib/money';
import {
  PRICE_LIST_KINDS,
  PRICE_LIST_STATUSES,
  type PriceEntry,
  type PriceList,
  type PriceListKind,
  type PriceListStatus,
} from './pricelist.types';
import type { CreatePriceListInput, PriceListRepository } from './pricelist.repository';

interface PriceListDoc {
  kind: PriceListKind;
  name: string;
  partnerId?: string;
  zoneId?: string;
  currency: string;
  version: number;
  status: PriceListStatus;
  effectiveFrom: Date;
  effectiveTo?: Date;
  entries: PriceEntry[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const entrySchema = new Schema<PriceEntry>(
  {
    serviceCode: { type: String, required: true },
    garmentCode: { type: String },
    unitAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const priceListSchema = new Schema<PriceListDoc>(
  {
    kind: { type: String, enum: PRICE_LIST_KINDS, required: true, index: true },
    name: { type: String, required: true },
    partnerId: { type: String, index: true },
    zoneId: { type: String, index: true },
    currency: { type: String, required: true, default: CURRENCY },
    version: { type: Number, required: true },
    status: {
      type: String,
      enum: PRICE_LIST_STATUSES,
      required: true,
      default: 'draft',
      index: true,
    },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    entries: { type: [entrySchema], required: true },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);
priceListSchema.index({ kind: 1, partnerId: 1, zoneId: 1, version: 1 }, { unique: true });

const PriceListModel = model<PriceListDoc>('PriceList', priceListSchema);

function toPriceList(doc: HydratedDocument<PriceListDoc>): PriceList {
  return {
    id: doc.id,
    kind: doc.kind,
    name: doc.name,
    ...(doc.partnerId ? { partnerId: doc.partnerId } : {}),
    ...(doc.zoneId ? { zoneId: doc.zoneId } : {}),
    currency: doc.currency,
    version: doc.version,
    status: doc.status,
    effectiveFrom: doc.effectiveFrom,
    ...(doc.effectiveTo ? { effectiveTo: doc.effectiveTo } : {}),
    entries: doc.entries,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class MongoPriceListRepository implements PriceListRepository {
  async create(input: CreatePriceListInput): Promise<PriceList> {
    const key = { kind: input.kind, partnerId: input.partnerId, zoneId: input.zoneId };
    const latest = await PriceListModel.findOne(key).sort({ version: -1 });
    const version = (latest?.version ?? 0) + 1;
    const doc = await PriceListModel.create({ ...input, version, currency: CURRENCY });
    return toPriceList(doc);
  }

  async findById(id: string): Promise<PriceList | null> {
    const doc = await PriceListModel.findById(id);
    return doc ? toPriceList(doc) : null;
  }

  async markPublished(id: string): Promise<PriceList> {
    const doc = await PriceListModel.findByIdAndUpdate(id, { status: 'published' }, { new: true });
    if (!doc) throw new Error('NOT_FOUND');
    return toPriceList(doc);
  }

  async listPublished(kind: PriceListKind): Promise<PriceList[]> {
    const docs = await PriceListModel.find({ kind, status: 'published' });
    return docs.map(toPriceList);
  }
}

export { PriceListModel };
