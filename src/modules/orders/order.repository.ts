import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../lib/errors';
import type { AddressSnapshot, Order, OrderPickup, OrderQuote } from './order.types';
import type { OrderStatus } from './order.status';

export interface CreateOrderData {
  orderCode: string;
  customerId: string;
  status: OrderStatus;
  currency: string;
  addressSnapshot: AddressSnapshot;
  zoneId: string;
  pickup: OrderPickup;
  quote: OrderQuote;
}

export interface OrderChanges {
  status?: OrderStatus;
  quote?: OrderQuote;
}

export interface OrderRepository {
  create(data: CreateOrderData): Promise<Order>;
  findById(id: string): Promise<Order | null>;
  findByCode(orderCode: string): Promise<Order | null>;
  listByCustomer(customerId: string): Promise<Order[]>;
  /** Optimistic-concurrency update: fails if the stored version != expected. */
  update(id: string, expectedVersion: number, changes: OrderChanges): Promise<Order>;
}

export class InMemoryOrderRepository implements OrderRepository {
  private readonly byId = new Map<string, Order>();

  async create(data: CreateOrderData): Promise<Order> {
    const now = new Date();
    const order: Order = { id: randomUUID(), version: 1, createdAt: now, updatedAt: now, ...data };
    this.byId.set(order.id, order);
    return structuredClone(order);
  }

  async findById(id: string): Promise<Order | null> {
    const order = this.byId.get(id);
    return order ? structuredClone(order) : null;
  }

  async findByCode(orderCode: string): Promise<Order | null> {
    for (const order of this.byId.values()) {
      if (order.orderCode === orderCode) return structuredClone(order);
    }
    return null;
  }

  async listByCustomer(customerId: string): Promise<Order[]> {
    return [...this.byId.values()]
      .filter((order) => order.customerId === customerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((order) => structuredClone(order));
  }

  async update(id: string, expectedVersion: number, changes: OrderChanges): Promise<Order> {
    const order = this.byId.get(id);
    if (!order) throw new ConflictError('Order not found.');
    if (order.version !== expectedVersion) {
      throw new ConflictError('The order has changed. Refresh and try again.');
    }
    const updated: Order = {
      ...order,
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.quote ? { quote: changes.quote } : {}),
      version: order.version + 1,
      updatedAt: new Date(),
    };
    this.byId.set(id, updated);
    return structuredClone(updated);
  }
}
