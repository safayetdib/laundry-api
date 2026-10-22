import { ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuditRepository } from '../audit/audit.repository';
import type { OrderRepository } from '../orders/order.repository';
import type { Role } from '../users/user.types';
import type { CreateQualityCaseData, QualityCaseRepository } from './quality.repository';
import type { QualityCase, QualityStatus } from './quality.types';

export interface QualityActor {
  id: string;
  roles: Role[];
}

export interface QualityServiceDeps {
  cases: QualityCaseRepository;
  orders: OrderRepository;
  audit: AuditRepository;
}

const STAFF: Role[] = ['admin', 'operations', 'support'];

function isStaff(actor: QualityActor): boolean {
  return actor.roles.some((r) => STAFF.includes(r));
}

export class QualityService {
  constructor(private readonly deps: QualityServiceDeps) {}

  /** A quality case may be opened by the order's customer or by staff. */
  async createCase(
    input: Omit<CreateQualityCaseData, 'createdBy'>,
    actor: QualityActor,
  ): Promise<QualityCase> {
    const order = await this.deps.orders.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found.');
    if (order.customerId !== actor.id && !isStaff(actor)) {
      throw new ForbiddenError('Not authorized to open a case on this order.');
    }
    const created = await this.deps.cases.create({ ...input, createdBy: actor.id });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'quality_case.opened',
      resourceType: 'QualityCase',
      resourceId: created.id,
      summary: { orderId: input.orderId, type: input.type },
    });
    return created;
  }

  /** Cases stay open independently of delivery; only staff resolve them. */
  async updateCase(
    id: string,
    changes: { status?: QualityStatus; resolution?: string },
    actor: QualityActor,
  ): Promise<QualityCase> {
    if (!isStaff(actor)) throw new ForbiddenError('Only staff can update a quality case.');
    const existing = await this.deps.cases.findById(id);
    if (!existing) throw new NotFoundError('Quality case not found.');
    const updated = await this.deps.cases.update(id, changes);
    await this.deps.audit.record({
      actor: actor.id,
      action: 'quality_case.updated',
      resourceType: 'QualityCase',
      resourceId: id,
      summary: { status: updated.status },
    });
    return updated;
  }

  async listForOrder(orderId: string): Promise<QualityCase[]> {
    return this.deps.cases.listByOrder(orderId);
  }
}
