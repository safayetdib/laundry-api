import type { OrderStatus } from './order.status';

export const QUOTE_STATUSES = ['pending_approval', 'approved', 'superseded'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface AddressSnapshot {
  contactName: string;
  phone: string;
  line1: string;
  area: string;
  city: string;
  note?: string;
}

export interface OrderLine {
  orderItemId: string;
  serviceCode: string;
  garmentCode?: string;
  displayName: string;
  quantity: number;
  unitAmount: number;
  lineAmount: number;
  priceListId: string;
  priceListVersion: number;
  conditionNotes?: string;
}

export interface OrderQuote {
  version: number;
  status: QuoteStatus;
  currency: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

export interface OrderPickup {
  slotKey: string;
  type: 'pickup';
  start: string;
  end: string;
}

export interface Order {
  id: string;
  orderCode: string;
  customerId: string;
  status: OrderStatus;
  currency: string;
  addressSnapshot: AddressSnapshot;
  zoneId: string;
  pickup: OrderPickup;
  quote: OrderQuote;
  /** Optimistic-concurrency version; bumped on every mutation. */
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDTO {
  id: string;
  orderCode: string;
  status: OrderStatus;
  currency: string;
  addressSnapshot: AddressSnapshot;
  zoneId: string;
  pickup: { type: 'pickup'; start: string; end: string };
  quote: Omit<OrderQuote, 'createdAt' | 'approvedAt'> & {
    createdAt: string;
    approvedAt?: string;
  };
  version: number;
  createdAt: string;
}

export function toOrderDTO(order: Order): OrderDTO {
  return {
    id: order.id,
    orderCode: order.orderCode,
    status: order.status,
    currency: order.currency,
    addressSnapshot: order.addressSnapshot,
    zoneId: order.zoneId,
    pickup: { type: 'pickup', start: order.pickup.start, end: order.pickup.end },
    quote: {
      version: order.quote.version,
      status: order.quote.status,
      currency: order.quote.currency,
      lines: order.quote.lines,
      subtotal: order.quote.subtotal,
      deliveryFee: order.quote.deliveryFee,
      discount: order.quote.discount,
      tax: order.quote.tax,
      total: order.quote.total,
      createdAt: order.quote.createdAt.toISOString(),
      ...(order.quote.approvedAt ? { approvedAt: order.quote.approvedAt.toISOString() } : {}),
      ...(order.quote.approvedBy ? { approvedBy: order.quote.approvedBy } : {}),
    },
    version: order.version,
    createdAt: order.createdAt.toISOString(),
  };
}
