import { Schema, model, type HydratedDocument } from 'mongoose';
import { ConflictError } from '../../lib/errors';
import { ORDER_STATUSES } from './order.status';
import { QUOTE_STATUSES, type Order } from './order.types';
import type { CreateOrderData, OrderChanges, OrderRepository } from './order.repository';

type OrderDoc = Omit<Order, 'id'>;

const lineSchema = new Schema(
  {
    orderItemId: { type: String, required: true },
    serviceCode: { type: String, required: true },
    garmentCode: { type: String },
    displayName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitAmount: { type: Number, required: true },
    lineAmount: { type: Number, required: true },
    priceListId: { type: String, required: true },
    priceListVersion: { type: Number, required: true },
    conditionNotes: { type: String },
  },
  { _id: false },
);

const quoteSchema = new Schema(
  {
    version: { type: Number, required: true },
    status: { type: String, enum: QUOTE_STATUSES, required: true },
    currency: { type: String, required: true },
    lines: { type: [lineSchema], required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    discount: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    createdAt: { type: Date, required: true },
    approvedAt: { type: Date },
    approvedBy: { type: String },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDoc>(
  {
    orderCode: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, index: true },
    currency: { type: String, required: true },
    addressSnapshot: { type: Schema.Types.Mixed, required: true },
    zoneId: { type: String, required: true, index: true },
    pickup: { type: Schema.Types.Mixed, required: true },
    quote: { type: quoteSchema, required: true },
    version: { type: Number, required: true, default: 1 },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  { minimize: false },
);

const OrderModel = model<OrderDoc>('Order', orderSchema);

function toOrder(doc: HydratedDocument<OrderDoc>): Order {
  const obj = doc.toObject() as OrderDoc & { _id: unknown };
  return { id: doc.id, ...obj } as unknown as Order;
}

export class MongoOrderRepository implements OrderRepository {
  async create(data: CreateOrderData): Promise<Order> {
    const now = new Date();
    const doc = await OrderModel.create({ ...data, version: 1, createdAt: now, updatedAt: now });
    return toOrder(doc);
  }

  async findById(id: string): Promise<Order | null> {
    const doc = await OrderModel.findById(id);
    return doc ? toOrder(doc) : null;
  }

  async findByCode(orderCode: string): Promise<Order | null> {
    const doc = await OrderModel.findOne({ orderCode });
    return doc ? toOrder(doc) : null;
  }

  async listByCustomer(customerId: string): Promise<Order[]> {
    const docs = await OrderModel.find({ customerId }).sort({ createdAt: -1 });
    return docs.map(toOrder);
  }

  async listRecent(limit: number): Promise<Order[]> {
    const docs = await OrderModel.find().sort({ createdAt: -1 }).limit(limit);
    return docs.map(toOrder);
  }

  async update(id: string, expectedVersion: number, changes: OrderChanges): Promise<Order> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (changes.status) set.status = changes.status;
    if (changes.quote) set.quote = changes.quote;

    const doc = await OrderModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: set, $inc: { version: 1 } },
      { new: true },
    );
    if (!doc) throw new ConflictError('The order has changed. Refresh and try again.');
    return toOrder(doc);
  }
}

export { OrderModel };
