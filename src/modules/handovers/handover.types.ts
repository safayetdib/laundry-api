export const HANDOVER_TYPES = ['pickup', 'intake', 'collection', 'delivery', 'correction'] as const;
export type HandoverType = (typeof HANDOVER_TYPES)[number];

export interface HandoverCount {
  orderItemId: string;
  quantity: number;
}

export interface HandoverDiscrepancy {
  orderItemId: string;
  expected: number;
  received: number;
  note?: string;
}

/**
 * Append-only record of a custody transfer or exception. Anchored to the
 * order (and optionally an assignment/delivery task); bag identity is not
 * required. `scanAssisted` records whether an optional scan was used — a
 * scan alone is never proof of a handover.
 */
export interface HandoverEvent {
  id: string;
  orderId: string;
  assignmentId?: string;
  deliveryTaskId?: string;
  type: HandoverType;
  actorId: string;
  fromParty?: string;
  toParty?: string;
  counts: HandoverCount[];
  discrepancies: HandoverDiscrepancy[];
  conditionNotes?: string;
  evidenceKeys: string[];
  scanAssisted: boolean;
  requestId?: string;
  occurredAt: Date;
  recordedAt: Date;
}

export interface HandoverEventDTO {
  id: string;
  orderId: string;
  assignmentId?: string;
  deliveryTaskId?: string;
  type: HandoverType;
  actorId: string;
  counts: HandoverCount[];
  discrepancies: HandoverDiscrepancy[];
  conditionNotes?: string;
  evidenceKeys: string[];
  scanAssisted: boolean;
  occurredAt: string;
  recordedAt: string;
}

export function toHandoverDTO(event: HandoverEvent): HandoverEventDTO {
  return {
    id: event.id,
    orderId: event.orderId,
    ...(event.assignmentId ? { assignmentId: event.assignmentId } : {}),
    ...(event.deliveryTaskId ? { deliveryTaskId: event.deliveryTaskId } : {}),
    type: event.type,
    actorId: event.actorId,
    counts: event.counts,
    discrepancies: event.discrepancies,
    ...(event.conditionNotes ? { conditionNotes: event.conditionNotes } : {}),
    evidenceKeys: event.evidenceKeys,
    scanAssisted: event.scanAssisted,
    occurredAt: event.occurredAt.toISOString(),
    recordedAt: event.recordedAt.toISOString(),
  };
}
