import { ConflictError } from '../../lib/errors';

export const ASSIGNMENT_STATUSES = [
  'assigned',
  'accepted',
  'rejected',
  'received',
  'processing',
  'ready_for_collection',
  'dispatched',
  'completed',
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

const ALLOWED: Record<AssignmentStatus, AssignmentStatus[]> = {
  assigned: ['accepted', 'rejected'],
  accepted: ['received', 'rejected'],
  received: ['processing'],
  processing: ['ready_for_collection'],
  ready_for_collection: ['dispatched'],
  dispatched: ['completed'],
  rejected: [],
  completed: [],
};

/** Statuses that still hold allocated order-item quantity. */
export const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  'assigned',
  'accepted',
  'received',
  'processing',
  'ready_for_collection',
  'dispatched',
  'completed',
];

export function canTransition(from: AssignmentStatus, to: AssignmentStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: AssignmentStatus, to: AssignmentStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Cannot transition assignment from ${from} to ${to}.`);
  }
}
