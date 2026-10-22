import { ConflictError } from '../../lib/errors';

export const ORDER_STATUSES = [
  'pending_confirmation',
  'confirmed',
  'pickup_scheduled',
  'picked_up',
  'in_service',
  'ready_for_delivery',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Allowed order status transitions. Later milestones use the later states. */
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['pickup_scheduled', 'cancelled'],
  pickup_scheduled: ['picked_up', 'cancelled'],
  picked_up: ['in_service'],
  in_service: ['ready_for_delivery'],
  ready_for_delivery: ['out_for_delivery'],
  out_for_delivery: ['delivered', 'ready_for_delivery'],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Cannot transition order from ${from} to ${to}.`);
  }
}
