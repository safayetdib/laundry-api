import type { AuditRepository } from '../audit/audit.repository';
import type { HandoverRepository, RecordHandoverData } from './handover.repository';
import type { HandoverEvent } from './handover.types';

export interface HandoverServiceDeps {
  handovers: HandoverRepository;
  audit: AuditRepository;
}

/**
 * Records and reads append-only handover events. Domain validation (actor
 * authorization, expected state, count reconciliation) is performed by the
 * calling service (e.g. processing intake, rider stop completion) before
 * recording, so the event log stays a faithful, immutable record.
 */
export class HandoverService {
  constructor(private readonly deps: HandoverServiceDeps) {}

  async record(data: RecordHandoverData): Promise<HandoverEvent> {
    const event = await this.deps.handovers.append(data);
    await this.deps.audit.record({
      actor: data.actorId,
      action: `handover.${data.type}`,
      resourceType: 'Order',
      resourceId: data.orderId,
      ...(data.requestId ? { requestId: data.requestId } : {}),
      summary: {
        handoverId: event.id,
        type: data.type,
        discrepancies: event.discrepancies.length,
        scanAssisted: event.scanAssisted,
      },
    });
    return event;
  }

  async listForOrder(orderId: string): Promise<HandoverEvent[]> {
    return this.deps.handovers.listByOrder(orderId);
  }
}
