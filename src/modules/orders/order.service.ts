import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../lib/errors';
import type { AuditRepository } from '../audit/audit.repository';
import type { ServiceRepository } from '../catalogue/service.repository';
import type { PricingService } from '../pricing/pricing.service';
import type { ZoneRepository } from '../zones/zone.repository';
import type { IdempotencyRepository } from '../idempotency/idempotency.repository';
import { hashRequest, runIdempotent } from '../idempotency/idempotency.service';
import { SlotService } from '../scheduling/slot.service';
import type { OrderRepository } from './order.repository';
import { assertTransition } from './order.status';
import {
  toOrderDTO,
  type AddressSnapshot,
  type Order,
  type OrderLine,
  type OrderQuote,
} from './order.types';
import type { Role } from '../users/user.types';

export interface OrderActor {
  id: string;
  roles: Role[];
}

export interface CreateOrderItemInput {
  serviceCode: string;
  garmentCode?: string;
  quantity: number;
  conditionNotes?: string;
}

export interface CreateOrderInput {
  addressSnapshot: AddressSnapshot;
  zoneId: string;
  items: CreateOrderItemInput[];
  pickupStart: string;
  deliveryFee?: number;
  discount?: number;
  taxBasisPoints?: number;
}

export interface OrderServiceDeps {
  orders: OrderRepository;
  zones: ZoneRepository;
  services: ServiceRepository;
  pricing: PricingService;
  slots: SlotService;
  idempotency: IdempotencyRepository;
  audit: AuditRepository;
  now?: () => Date;
}

const STAFF_ROLES: Role[] = ['admin', 'operations', 'support'];

function isStaff(actor: OrderActor): boolean {
  return actor.roles.some((role) => STAFF_ROLES.includes(role));
}

function generateOrderCode(): string {
  return `FLD-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export class OrderService {
  private readonly now: () => Date;

  constructor(private readonly deps: OrderServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async createOrder(
    input: CreateOrderInput,
    actor: OrderActor,
    idempotencyKey?: string,
  ): Promise<Order> {
    if (input.items.length === 0) {
      throw new ValidationError('An order must contain at least one item.');
    }

    return runIdempotent<Order>(
      this.deps.idempotency,
      { scope: `order.create:${actor.id}`, key: idempotencyKey, requestHash: hashRequest(input) },
      async () => this.doCreateOrder(input, actor),
    );
  }

  private async doCreateOrder(input: CreateOrderInput, actor: OrderActor): Promise<Order> {
    const zone = await this.deps.zones.findById(input.zoneId);
    if (!zone || !zone.active) throw new ValidationError('Zone is not serviceable.');

    const at = this.now();
    const quoteResult = await this.deps.pricing.calculateQuote({
      items: input.items.map((item) => ({
        serviceCode: item.serviceCode,
        ...(item.garmentCode ? { garmentCode: item.garmentCode } : {}),
        quantity: item.quantity,
      })),
      zoneId: input.zoneId,
      ...(input.deliveryFee !== undefined ? { deliveryFee: input.deliveryFee } : {}),
      ...(input.discount !== undefined ? { discount: input.discount } : {}),
      ...(input.taxBasisPoints !== undefined ? { taxBasisPoints: input.taxBasisPoints } : {}),
      at,
    });

    const lines: OrderLine[] = [];
    for (let i = 0; i < quoteResult.lines.length; i += 1) {
      const line = quoteResult.lines[i]!;
      const inputItem = input.items[i]!;
      const service = await this.deps.services.findByCode(line.serviceCode);
      lines.push({
        orderItemId: randomUUID(),
        serviceCode: line.serviceCode,
        ...(line.garmentCode ? { garmentCode: line.garmentCode } : {}),
        displayName: service?.name ?? line.serviceCode,
        quantity: line.quantity,
        unitAmount: line.unitAmount,
        lineAmount: line.lineAmount,
        priceListId: line.priceListId,
        priceListVersion: line.priceListVersion,
        ...(inputItem.conditionNotes ? { conditionNotes: inputItem.conditionNotes } : {}),
      });
    }

    const reserved = await this.deps.slots.reserve(zone, 'pickup', input.pickupStart);

    try {
      const quote: OrderQuote = {
        version: 1,
        status: 'pending_approval',
        currency: quoteResult.currency,
        lines,
        subtotal: quoteResult.subtotal,
        deliveryFee: quoteResult.deliveryFee,
        discount: quoteResult.discount,
        tax: quoteResult.tax,
        total: quoteResult.total,
        createdAt: at,
      };

      const order = await this.deps.orders.create({
        orderCode: generateOrderCode(),
        customerId: actor.id,
        status: 'pending_confirmation',
        currency: quoteResult.currency,
        addressSnapshot: input.addressSnapshot,
        zoneId: input.zoneId,
        pickup: {
          slotKey: reserved.slotKey,
          type: 'pickup',
          start: reserved.start,
          end: reserved.end,
        },
        quote,
      });

      await this.deps.audit.record({
        actor: actor.id,
        action: 'order.created',
        resourceType: 'Order',
        resourceId: order.id,
        summary: { total: order.quote.total, items: lines.length },
      });
      return order;
    } catch (err) {
      // Avoid leaking a slot reservation if order creation failed.
      await this.deps.slots.release(reserved.slotKey);
      throw err;
    }
  }

  private authorizeView(order: Order, actor: OrderActor): void {
    if (isStaff(actor) || order.customerId === actor.id) return;
    // Hide existence from unauthorized users.
    throw new NotFoundError('Order not found.');
  }

  async getByCode(orderCode: string, actor: OrderActor): Promise<Order> {
    const order = await this.deps.orders.findByCode(orderCode);
    if (!order) throw new NotFoundError('Order not found.');
    this.authorizeView(order, actor);
    return order;
  }

  async listForCustomer(customerId: string): Promise<Order[]> {
    return this.deps.orders.listByCustomer(customerId);
  }

  async approveQuote(orderId: string, quoteVersion: number, actor: OrderActor): Promise<Order> {
    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found.');
    if (order.customerId !== actor.id && !isStaff(actor)) {
      throw new ForbiddenError('Only the customer can approve the quote.');
    }
    if (order.status !== 'pending_confirmation') {
      throw new ConflictError('Quote can only be approved before confirmation.');
    }
    if (order.quote.version !== quoteVersion) {
      throw new ConflictError('Stale quote version. Refresh the order.');
    }
    if (order.quote.status === 'approved') return order;

    const quote: OrderQuote = {
      ...order.quote,
      status: 'approved',
      approvedAt: this.now(),
      approvedBy: actor.id,
    };
    const updated = await this.deps.orders.update(order.id, order.version, { quote });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'order.quote_approved',
      resourceType: 'Order',
      resourceId: order.id,
      summary: { quoteVersion },
    });
    return updated;
  }

  async confirmOrder(orderId: string, actor: OrderActor): Promise<Order> {
    if (!isStaff(actor)) throw new ForbiddenError('Only staff can confirm orders.');
    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found.');
    if (order.quote.status !== 'approved') {
      throw new UnprocessableError('The customer must approve the quote before confirmation.');
    }
    assertTransition(order.status, 'confirmed');
    const updated = await this.deps.orders.update(order.id, order.version, { status: 'confirmed' });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'order.confirmed',
      resourceType: 'Order',
      resourceId: order.id,
    });
    return updated;
  }

  async cancelOrder(orderId: string, actor: OrderActor): Promise<Order> {
    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new NotFoundError('Order not found.');
    if (order.customerId !== actor.id && !isStaff(actor)) {
      throw new ForbiddenError('Not authorized to cancel this order.');
    }
    assertTransition(order.status, 'cancelled');

    await this.deps.slots.release(order.pickup.slotKey);
    const updated = await this.deps.orders.update(order.id, order.version, { status: 'cancelled' });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'order.cancelled',
      resourceType: 'Order',
      resourceId: order.id,
    });
    return updated;
  }

  toDTO = toOrderDTO;
}
