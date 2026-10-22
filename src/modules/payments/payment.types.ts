export const PAYMENT_METHODS = ['cod', 'bkash', 'nagad'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_ENTRY_TYPES = ['collection', 'refund', 'adjustment'] as const;
export type PaymentEntryType = (typeof PAYMENT_ENTRY_TYPES)[number];

export const PAYMENT_ENTRY_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type PaymentEntryStatus = (typeof PAYMENT_ENTRY_STATUSES)[number];

/**
 * Immutable-ish ledger entry. Collections and refunds are separate entries;
 * a successful collection is never overwritten to represent a refund
 * (loophole-review P0 #2). Only a `pending` entry may move to verified or
 * rejected; a verified entry is final.
 */
export interface PaymentEntry {
  id: string;
  orderId: string;
  method: PaymentMethod;
  type: PaymentEntryType;
  amount: number;
  currency: string;
  status: PaymentEntryStatus;
  reference?: string;
  /** For COD: the amount that was expected, for reconciliation. */
  expectedAmount?: number;
  recordedBy: string;
  verifiedBy?: string;
  createdAt: Date;
  verifiedAt?: Date;
}

export interface PaymentBalance {
  currency: string;
  orderTotal: number;
  collected: number;
  refunded: number;
  netPaid: number;
  outstanding: number;
  state: 'unpaid' | 'partial' | 'paid' | 'overpaid';
  pendingVerification: number;
}

export interface PaymentEntryDTO {
  id: string;
  orderId: string;
  method: PaymentMethod;
  type: PaymentEntryType;
  amount: number;
  currency: string;
  status: PaymentEntryStatus;
  reference?: string;
  expectedAmount?: number;
  createdAt: string;
  verifiedAt?: string;
}

export function toPaymentEntryDTO(entry: PaymentEntry): PaymentEntryDTO {
  return {
    id: entry.id,
    orderId: entry.orderId,
    method: entry.method,
    type: entry.type,
    amount: entry.amount,
    currency: entry.currency,
    status: entry.status,
    ...(entry.reference ? { reference: entry.reference } : {}),
    ...(entry.expectedAmount !== undefined ? { expectedAmount: entry.expectedAmount } : {}),
    createdAt: entry.createdAt.toISOString(),
    ...(entry.verifiedAt ? { verifiedAt: entry.verifiedAt.toISOString() } : {}),
  };
}
