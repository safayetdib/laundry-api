import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors';
import type { AssignmentRepository } from '../assignments/assignment.repository';
import { assertTransition } from '../assignments/assignment.status';
import type { AssignmentActor } from '../assignments/assignment.service';
import type { IntakeDiscrepancy, PartnerAssignment } from '../assignments/assignment.types';
import type { HandoverService } from '../handovers/handover.service';

export interface RecordIntakeInput {
  receivedItems: { orderItemId: string; quantity: number }[];
  conditionNotes?: string;
  evidenceKeys?: string[];
  scanAssisted?: boolean;
}

export interface ProcessingServiceDeps {
  assignments: AssignmentRepository;
  handovers: HandoverService;
  now?: () => Date;
}

export class ProcessingService {
  private readonly now: () => Date;

  constructor(private readonly deps: ProcessingServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /**
   * Partner records received quantities at intake. The assignment's `items`
   * keep the expected (assigned) quantities; the intake keeps the received
   * quantities and the discrepancies — neither overwrites the other. An
   * append-only intake handover event is recorded.
   */
  async recordIntake(
    assignmentId: string,
    input: RecordIntakeInput,
    actor: AssignmentActor,
    requestId?: string,
  ): Promise<PartnerAssignment> {
    const assignment = await this.deps.assignments.findById(assignmentId);
    if (!assignment) throw new NotFoundError('Assignment not found.');
    if (!actor.roles.includes('partner_staff') || actor.partnerId !== assignment.partnerId) {
      throw new ForbiddenError('Not authorized for this assignment.');
    }
    // Intake is only valid once the partner has accepted the assignment.
    assertTransition(assignment.status, 'received');

    const expected = new Map(assignment.items.map((i) => [i.orderItemId, i.quantity]));
    const received = new Map<string, number>();
    for (const item of input.receivedItems) {
      if (!expected.has(item.orderItemId)) {
        throw new ValidationError(`Order item ${item.orderItemId} is not in this assignment.`);
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 0) {
        throw new ValidationError('Received quantity must be a non-negative integer.');
      }
      received.set(item.orderItemId, (received.get(item.orderItemId) ?? 0) + item.quantity);
    }

    const discrepancies: IntakeDiscrepancy[] = [];
    for (const [orderItemId, expectedQty] of expected) {
      const receivedQty = received.get(orderItemId) ?? 0;
      if (receivedQty !== expectedQty) {
        discrepancies.push({ orderItemId, expected: expectedQty, received: receivedQty });
      }
    }

    const now = this.now();
    const receivedItems = [...received.entries()].map(([orderItemId, quantity]) => ({
      orderItemId,
      quantity,
    }));

    await this.deps.handovers.record({
      orderId: assignment.orderId,
      assignmentId: assignment.id,
      type: 'intake',
      actorId: actor.id,
      counts: receivedItems,
      discrepancies,
      ...(input.conditionNotes ? { conditionNotes: input.conditionNotes } : {}),
      ...(input.evidenceKeys ? { evidenceKeys: input.evidenceKeys } : {}),
      scanAssisted: input.scanAssisted ?? false,
      ...(requestId ? { requestId } : {}),
      occurredAt: now,
    });

    return this.deps.assignments.update(assignment.id, assignment.version, {
      status: 'received',
      receivedAt: now,
      intake: { receivedItems, discrepancies, recordedBy: actor.id, recordedAt: now },
    });
  }
}
