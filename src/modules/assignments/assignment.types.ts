import type { AssignmentStatus } from './assignment.status';

export interface AssignmentItem {
  orderItemId: string;
  serviceCode: string;
  garmentCode?: string;
  quantity: number;
}

export interface AssignmentPayable {
  currency: string;
  amount: number;
}

export interface IntakeDiscrepancy {
  orderItemId: string;
  expected: number;
  received: number;
  note?: string;
}

/**
 * Partner intake record. The assignment's `items` keep the expected
 * (assigned) quantities; `receivedItems` keeps the partner-received
 * quantities. Both are preserved — one never overwrites the other.
 */
export interface AssignmentIntake {
  receivedItems: { orderItemId: string; quantity: number }[];
  discrepancies: IntakeDiscrepancy[];
  recordedBy: string;
  recordedAt: Date;
}

export interface PartnerAssignment {
  id: string;
  orderId: string;
  partnerId: string;
  status: AssignmentStatus;
  items: AssignmentItem[];
  /** Snapshot of the partner payable cost, or null when no partner rate exists yet. */
  payable: AssignmentPayable | null;
  intake?: AssignmentIntake;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  acceptedAt?: Date;
  receivedAt?: Date;
  completedAt?: Date;
}

export interface AssignmentDTO {
  id: string;
  orderId: string;
  partnerId: string;
  status: AssignmentStatus;
  items: AssignmentItem[];
  payable: AssignmentPayable | null;
  intake?: AssignmentIntake;
  version: number;
  createdAt: string;
}

export function toAssignmentDTO(assignment: PartnerAssignment): AssignmentDTO {
  return {
    id: assignment.id,
    orderId: assignment.orderId,
    partnerId: assignment.partnerId,
    status: assignment.status,
    items: assignment.items,
    payable: assignment.payable,
    ...(assignment.intake ? { intake: assignment.intake } : {}),
    version: assignment.version,
    createdAt: assignment.createdAt.toISOString(),
  };
}
