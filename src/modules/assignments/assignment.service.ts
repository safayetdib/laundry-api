import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../lib/errors';
import { CURRENCY } from '../../lib/money';
import type { AuditRepository } from '../audit/audit.repository';
import type { OrderRepository } from '../orders/order.repository';
import type { PartnerRepository } from '../partners/partner.repository';
import type { PricingService } from '../pricing/pricing.service';
import type { Role } from '../users/user.types';
import type { AssignmentRepository } from './assignment.repository';
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  assertTransition,
  type AssignmentStatus,
} from './assignment.status';
import type { AssignmentItem, AssignmentPayable, PartnerAssignment } from './assignment.types';

export interface AssignmentActor {
  id: string;
  roles: Role[];
  partnerId?: string;
}

export interface AssignmentServiceDeps {
  assignments: AssignmentRepository;
  orders: OrderRepository;
  partners: PartnerRepository;
  pricing: PricingService;
  audit: AuditRepository;
  now?: () => Date;
}

const NON_ASSIGNABLE_ORDER_STATUSES = ['pending_confirmation', 'cancelled', 'delivered'];

export class AssignmentService {
  private readonly now: () => Date;

  constructor(private readonly deps: AssignmentServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async createAssignment(
    orderId: string,
    partnerId: string,
    items: AssignmentItem[],
    actor: AssignmentActor,
  ): Promise<PartnerAssignment> {
    if (items.length === 0) throw new ValidationError('An assignment needs at least one item.');

    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found.');
    if (NON_ASSIGNABLE_ORDER_STATUSES.includes(order.status)) {
      throw new ConflictError(`Order in status ${order.status} cannot be assigned.`);
    }

    const partner = await this.deps.partners.findById(partnerId);
    if (!partner || partner.status !== 'active') {
      throw new ValidationError('Partner is not available for assignment.');
    }
    if (!partner.zoneIds.includes(order.zoneId)) {
      throw new ValidationError('Partner does not serve this order zone.');
    }

    // Confirmed quantities per order item.
    const confirmed = new Map(order.quote.lines.map((l) => [l.orderItemId, l]));

    // Already-allocated quantities across active assignments.
    const existing = await this.deps.assignments.listByOrder(orderId);
    const allocated = new Map<string, number>();
    for (const a of existing) {
      if (!ACTIVE_ASSIGNMENT_STATUSES.includes(a.status)) continue;
      for (const item of a.items) {
        allocated.set(item.orderItemId, (allocated.get(item.orderItemId) ?? 0) + item.quantity);
      }
    }

    // Validate capability + allocation for the new items (including intra-request sums).
    const requested = new Map<string, number>();
    for (const item of items) {
      const line = confirmed.get(item.orderItemId);
      if (!line || line.serviceCode !== item.serviceCode) {
        throw new ValidationError(`Unknown order item ${item.orderItemId} for this order.`);
      }
      if (!partner.serviceCodes.includes(item.serviceCode)) {
        throw new ValidationError(`Partner cannot process service ${item.serviceCode}.`);
      }
      requested.set(item.orderItemId, (requested.get(item.orderItemId) ?? 0) + item.quantity);
    }
    for (const [orderItemId, qty] of requested) {
      const line = confirmed.get(orderItemId)!;
      const total = (allocated.get(orderItemId) ?? 0) + qty;
      if (total > line.quantity) {
        throw new UnprocessableError('Assigned quantity exceeds the confirmed order quantity.', {
          orderItemId,
          confirmed: line.quantity,
          alreadyAllocated: allocated.get(orderItemId) ?? 0,
          requested: qty,
        });
      }
    }

    const payable = await this.computePayable(items, partnerId, order.zoneId);

    const assignment = await this.deps.assignments.create({
      orderId,
      partnerId,
      status: 'assigned',
      items,
      payable,
    });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'assignment.created',
      resourceType: 'PartnerAssignment',
      resourceId: assignment.id,
      summary: { orderId, partnerId, items: items.length, payable },
    });
    return assignment;
  }

  private async computePayable(
    items: AssignmentItem[],
    partnerId: string,
    zoneId: string,
  ): Promise<AssignmentPayable | null> {
    let amount = 0;
    for (const item of items) {
      try {
        const price = await this.deps.pricing.selectPrice({
          kind: 'partner',
          serviceCode: item.serviceCode,
          ...(item.garmentCode ? { garmentCode: item.garmentCode } : {}),
          zoneId,
          partnerId,
          at: this.now(),
        });
        amount += price.unitAmount * item.quantity;
      } catch {
        // No single applicable partner rate yet; record payable as unknown.
        return null;
      }
    }
    return { currency: CURRENCY, amount };
  }

  private ensurePartnerScope(assignment: PartnerAssignment, actor: AssignmentActor): void {
    if (!actor.roles.includes('partner_staff') || actor.partnerId !== assignment.partnerId) {
      throw new ForbiddenError('Not authorized for this assignment.');
    }
  }

  async listForPartner(partnerId: string): Promise<PartnerAssignment[]> {
    return this.deps.assignments.listByPartner(partnerId);
  }

  async updateStatus(
    id: string,
    target: AssignmentStatus,
    actor: AssignmentActor,
  ): Promise<PartnerAssignment> {
    const assignment = await this.deps.assignments.findById(id);
    if (!assignment) throw new NotFoundError('Assignment not found.');
    this.ensurePartnerScope(assignment, actor);
    assertTransition(assignment.status, target);

    const now = this.now();
    const changes: {
      status: AssignmentStatus;
      acceptedAt?: Date;
      receivedAt?: Date;
      completedAt?: Date;
    } = {
      status: target,
    };
    if (target === 'accepted') changes.acceptedAt = now;
    if (target === 'received') changes.receivedAt = now;
    if (target === 'completed') changes.completedAt = now;

    const updated = await this.deps.assignments.update(id, assignment.version, changes);
    await this.deps.audit.record({
      actor: actor.id,
      action: 'assignment.status_changed',
      resourceType: 'PartnerAssignment',
      resourceId: id,
      summary: { from: assignment.status, to: target },
    });
    return updated;
  }
}
