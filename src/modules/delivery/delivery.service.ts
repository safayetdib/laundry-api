import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuditRepository } from '../audit/audit.repository';
import type { HandoverService } from '../handovers/handover.service';
import type { HandoverCount } from '../handovers/handover.types';
import type { OrderRepository } from '../orders/order.repository';
import { assertTransition } from '../orders/order.status';
import type { PaymentService } from '../payments/payment.service';
import type { Role } from '../users/user.types';
import type { DeliveryTaskRepository } from './delivery.repository';
import type { DeliveryTask } from './delivery.types';

export interface DeliveryActor {
  id: string;
  roles: Role[];
}

export interface DeliveryServiceDeps {
  tasks: DeliveryTaskRepository;
  orders: OrderRepository;
  handovers: HandoverService;
  payments: PaymentService;
  audit: AuditRepository;
  now?: () => Date;
}

const STAFF: Role[] = ['admin', 'operations', 'support'];
const COMPLETABLE: DeliveryTask['status'][] = ['scheduled', 'en_route', 'arrived'];

function isStaff(actor: DeliveryActor): boolean {
  return actor.roles.some((r) => STAFF.includes(r));
}

export class DeliveryService {
  private readonly now: () => Date;

  constructor(private readonly deps: DeliveryServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  private requireStaff(actor: DeliveryActor): void {
    if (!isStaff(actor)) throw new ForbiddenError('Only operations staff can do this.');
  }

  private requireRider(task: DeliveryTask, actor: DeliveryActor): void {
    if (isStaff(actor)) return;
    if (!actor.roles.includes('rider') || task.riderId !== actor.id) {
      throw new ForbiddenError('Not your task.');
    }
  }

  async listForRider(riderId: string): Promise<DeliveryTask[]> {
    return this.deps.tasks.listByRider(riderId);
  }

  async createPickupTask(
    orderId: string,
    actor: DeliveryActor,
    riderId?: string,
  ): Promise<DeliveryTask> {
    this.requireStaff(actor);
    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found.');
    assertTransition(order.status, 'pickup_scheduled');

    const task = await this.deps.tasks.create({
      orderId,
      type: 'pickup',
      ...(riderId ? { riderId } : {}),
      scheduledStart: order.pickup.start,
      scheduledEnd: order.pickup.end,
    });
    await this.deps.orders.update(order.id, order.version, { status: 'pickup_scheduled' });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'delivery.pickup_scheduled',
      resourceType: 'Order',
      resourceId: orderId,
      summary: { taskId: task.id },
    });
    return task;
  }

  async completePickup(
    taskId: string,
    input: {
      counts: HandoverCount[];
      evidenceKeys?: string[];
      conditionNotes?: string;
      scanAssisted?: boolean;
    },
    actor: DeliveryActor,
  ): Promise<DeliveryTask> {
    const task = await this.loadCompletableTask(taskId, 'pickup', actor);
    const order = await this.deps.orders.findById(task.orderId);
    if (!order) throw new NotFoundError('Order not found.');
    assertTransition(order.status, 'picked_up');

    await this.deps.handovers.record({
      orderId: order.id,
      deliveryTaskId: task.id,
      type: 'pickup',
      actorId: actor.id,
      counts: input.counts,
      ...(input.conditionNotes ? { conditionNotes: input.conditionNotes } : {}),
      ...(input.evidenceKeys ? { evidenceKeys: input.evidenceKeys } : {}),
      scanAssisted: input.scanAssisted ?? false,
      occurredAt: this.now(),
    });
    const updated = await this.deps.tasks.update(task.id, task.version, {
      status: 'completed',
      completedAt: this.now(),
      ...(input.evidenceKeys ? { evidenceKeys: input.evidenceKeys } : {}),
    });
    await this.deps.orders.update(order.id, order.version, { status: 'picked_up' });
    return updated;
  }

  async createDeliveryTask(
    orderId: string,
    actor: DeliveryActor,
    window: { scheduledStart: string; scheduledEnd: string },
    riderId?: string,
  ): Promise<DeliveryTask> {
    this.requireStaff(actor);
    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found.');
    assertTransition(order.status, 'out_for_delivery');

    const task = await this.deps.tasks.create({
      orderId,
      type: 'return_delivery',
      ...(riderId ? { riderId } : {}),
      scheduledStart: window.scheduledStart,
      scheduledEnd: window.scheduledEnd,
    });
    await this.deps.orders.update(order.id, order.version, { status: 'out_for_delivery' });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'delivery.dispatched',
      resourceType: 'Order',
      resourceId: orderId,
      summary: { taskId: task.id },
    });
    return task;
  }

  async completeDelivery(
    taskId: string,
    input: {
      codAmountCollected?: number;
      evidenceKeys?: string[];
      conditionNotes?: string;
      scanAssisted?: boolean;
    },
    actor: DeliveryActor,
  ): Promise<DeliveryTask> {
    const task = await this.loadCompletableTask(taskId, 'return_delivery', actor);
    const order = await this.deps.orders.findById(task.orderId);
    if (!order) throw new NotFoundError('Order not found.');
    assertTransition(order.status, 'delivered');

    await this.deps.handovers.record({
      orderId: order.id,
      deliveryTaskId: task.id,
      type: 'delivery',
      actorId: actor.id,
      counts: [],
      ...(input.conditionNotes ? { conditionNotes: input.conditionNotes } : {}),
      ...(input.evidenceKeys ? { evidenceKeys: input.evidenceKeys } : {}),
      scanAssisted: input.scanAssisted ?? false,
      occurredAt: this.now(),
    });

    if (input.codAmountCollected !== undefined) {
      const balance = await this.deps.payments.getBalance(order.id, order.quote.total);
      await this.deps.payments.recordCodCollection(
        order.id,
        input.codAmountCollected,
        Math.max(balance.outstanding, 0),
        actor,
        task.id,
      );
    }

    const updated = await this.deps.tasks.update(task.id, task.version, {
      status: 'completed',
      completedAt: this.now(),
      ...(input.codAmountCollected !== undefined
        ? { codAmountCollected: input.codAmountCollected }
        : {}),
      ...(input.evidenceKeys ? { evidenceKeys: input.evidenceKeys } : {}),
    });
    await this.deps.orders.update(order.id, order.version, { status: 'delivered' });
    return updated;
  }

  async failDelivery(taskId: string, reason: string, actor: DeliveryActor): Promise<DeliveryTask> {
    const task = await this.loadCompletableTask(taskId, 'return_delivery', actor);
    const order = await this.deps.orders.findById(task.orderId);
    if (!order) throw new NotFoundError('Order not found.');
    assertTransition(order.status, 'ready_for_delivery');

    const updated = await this.deps.tasks.update(task.id, task.version, {
      status: 'failed',
      failureReason: reason,
      attempts: task.attempts + 1,
    });
    await this.deps.orders.update(order.id, order.version, { status: 'ready_for_delivery' });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'delivery.failed',
      resourceType: 'Order',
      resourceId: order.id,
      summary: { taskId: task.id, reason },
    });
    return updated;
  }

  private async loadCompletableTask(
    taskId: string,
    type: DeliveryTask['type'],
    actor: DeliveryActor,
  ): Promise<DeliveryTask> {
    const task = await this.deps.tasks.findById(taskId);
    if (!task) throw new NotFoundError('Delivery task not found.');
    if (task.type !== type) throw new ConflictError(`Task is not a ${type} task.`);
    if (!COMPLETABLE.includes(task.status)) {
      throw new ConflictError(`Task in status ${task.status} cannot be completed.`);
    }
    this.requireRider(task, actor);
    return task;
  }
}
