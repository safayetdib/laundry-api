import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../lib/errors';
import type {
  PaymentEntry,
  PaymentEntryStatus,
  PaymentEntryType,
  PaymentMethod,
} from './payment.types';

export interface CreatePaymentEntryData {
  orderId: string;
  method: PaymentMethod;
  type: PaymentEntryType;
  amount: number;
  currency: string;
  status: PaymentEntryStatus;
  reference?: string;
  expectedAmount?: number;
  recordedBy: string;
  verifiedBy?: string;
  verifiedAt?: Date;
}

export interface PaymentRepository {
  create(data: CreatePaymentEntryData): Promise<PaymentEntry>;
  findById(id: string): Promise<PaymentEntry | null>;
  listByOrder(orderId: string): Promise<PaymentEntry[]>;
  /** Moves a pending entry to verified/rejected; fails if not pending. */
  resolvePending(
    id: string,
    status: 'verified' | 'rejected',
    verifiedBy: string,
    verifiedAt: Date,
  ): Promise<PaymentEntry>;
}

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly byId = new Map<string, PaymentEntry>();

  async create(data: CreatePaymentEntryData): Promise<PaymentEntry> {
    const entry: PaymentEntry = { id: randomUUID(), createdAt: new Date(), ...data };
    this.byId.set(entry.id, entry);
    return structuredClone(entry);
  }

  async findById(id: string): Promise<PaymentEntry | null> {
    const e = this.byId.get(id);
    return e ? structuredClone(e) : null;
  }

  async listByOrder(orderId: string): Promise<PaymentEntry[]> {
    return [...this.byId.values()]
      .filter((e) => e.orderId === orderId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => structuredClone(e));
  }

  async resolvePending(
    id: string,
    status: 'verified' | 'rejected',
    verifiedBy: string,
    verifiedAt: Date,
  ): Promise<PaymentEntry> {
    const entry = this.byId.get(id);
    if (!entry) throw new ConflictError('Payment entry not found.');
    if (entry.status !== 'pending') {
      throw new ConflictError('Only a pending payment entry can be resolved.');
    }
    const updated: PaymentEntry = { ...entry, status, verifiedBy, verifiedAt };
    this.byId.set(id, updated);
    return structuredClone(updated);
  }
}
