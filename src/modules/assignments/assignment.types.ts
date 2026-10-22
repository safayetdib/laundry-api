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

export interface PartnerAssignment {
  id: string;
  orderId: string;
  partnerId: string;
  status: AssignmentStatus;
  items: AssignmentItem[];
  /** Snapshot of the partner payable cost, or null when no partner rate exists yet. */
  payable: AssignmentPayable | null;
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
    version: assignment.version,
    createdAt: assignment.createdAt.toISOString(),
  };
}
