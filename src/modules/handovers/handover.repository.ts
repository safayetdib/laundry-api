import { randomUUID } from 'node:crypto';
import type {
  HandoverCount,
  HandoverDiscrepancy,
  HandoverEvent,
  HandoverType,
} from './handover.types';

export interface RecordHandoverData {
  orderId: string;
  assignmentId?: string;
  deliveryTaskId?: string;
  type: HandoverType;
  actorId: string;
  fromParty?: string;
  toParty?: string;
  counts: HandoverCount[];
  discrepancies?: HandoverDiscrepancy[];
  conditionNotes?: string;
  evidenceKeys?: string[];
  scanAssisted?: boolean;
  requestId?: string;
  occurredAt?: Date;
}

/** Append-only store: events are created and read, never updated or deleted. */
export interface HandoverRepository {
  append(data: RecordHandoverData): Promise<HandoverEvent>;
  listByOrder(orderId: string): Promise<HandoverEvent[]>;
}

function build(data: RecordHandoverData): HandoverEvent {
  const now = new Date();
  return {
    id: randomUUID(),
    orderId: data.orderId,
    ...(data.assignmentId ? { assignmentId: data.assignmentId } : {}),
    ...(data.deliveryTaskId ? { deliveryTaskId: data.deliveryTaskId } : {}),
    type: data.type,
    actorId: data.actorId,
    ...(data.fromParty ? { fromParty: data.fromParty } : {}),
    ...(data.toParty ? { toParty: data.toParty } : {}),
    counts: data.counts,
    discrepancies: data.discrepancies ?? [],
    ...(data.conditionNotes ? { conditionNotes: data.conditionNotes } : {}),
    evidenceKeys: data.evidenceKeys ?? [],
    scanAssisted: data.scanAssisted ?? false,
    ...(data.requestId ? { requestId: data.requestId } : {}),
    occurredAt: data.occurredAt ?? now,
    recordedAt: now,
  };
}

export class InMemoryHandoverRepository implements HandoverRepository {
  private readonly events: HandoverEvent[] = [];

  async append(data: RecordHandoverData): Promise<HandoverEvent> {
    const event = build(data);
    this.events.push(event);
    return structuredClone(event);
  }

  async listByOrder(orderId: string): Promise<HandoverEvent[]> {
    return this.events
      .filter((e) => e.orderId === orderId)
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
      .map((e) => structuredClone(e));
  }
}
