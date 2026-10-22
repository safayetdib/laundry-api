import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors';
import { CURRENCY, assertMinor } from '../../lib/money';
import type { AuditRepository } from '../audit/audit.repository';
import type { IdempotencyRepository } from '../idempotency/idempotency.repository';
import { hashRequest, runIdempotent } from '../idempotency/idempotency.service';
import type { Role } from '../users/user.types';
import type { PaymentRepository } from './payment.repository';
import type { PaymentBalance, PaymentEntry, PaymentMethod } from './payment.types';

export interface PaymentActor {
  id: string;
  roles: Role[];
}

export interface PaymentServiceDeps {
  payments: PaymentRepository;
  audit: AuditRepository;
  idempotency: IdempotencyRepository;
  now?: () => Date;
}

function isStaff(actor: PaymentActor): boolean {
  return actor.roles.some((r) => (['admin', 'operations', 'support'] as Role[]).includes(r));
}

export function computeBalance(
  entries: PaymentEntry[],
  orderTotal: number,
  currency = CURRENCY,
): PaymentBalance {
  let collected = 0;
  let refunded = 0;
  let pendingVerification = 0;
  for (const e of entries) {
    if (e.status === 'pending') pendingVerification += e.amount;
    if (e.status !== 'verified') continue;
    if (e.type === 'collection') collected += e.amount;
    if (e.type === 'refund') refunded += e.amount;
  }
  const netPaid = collected - refunded;
  const outstanding = orderTotal - netPaid;
  const state =
    netPaid <= 0
      ? 'unpaid'
      : netPaid < orderTotal
        ? 'partial'
        : netPaid === orderTotal
          ? 'paid'
          : 'overpaid';
  return {
    currency,
    orderTotal,
    collected,
    refunded,
    netPaid,
    outstanding,
    state,
    pendingVerification,
  };
}

export class PaymentService {
  private readonly now: () => Date;

  constructor(private readonly deps: PaymentServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async listForOrder(orderId: string): Promise<PaymentEntry[]> {
    return this.deps.payments.listByOrder(orderId);
  }

  async getBalance(orderId: string, orderTotal: number): Promise<PaymentBalance> {
    return computeBalance(await this.deps.payments.listByOrder(orderId), orderTotal);
  }

  /** Records a manual bKash/Nagad payment; it stays pending until verified. */
  async recordManualPayment(
    orderId: string,
    method: Exclude<PaymentMethod, 'cod'>,
    amount: number,
    actor: PaymentActor,
    reference?: string,
  ): Promise<PaymentEntry> {
    assertMinor(amount, 'amount');
    if (amount <= 0) throw new ValidationError('Payment amount must be positive.');
    const entry = await this.deps.payments.create({
      orderId,
      method,
      type: 'collection',
      amount,
      currency: CURRENCY,
      status: 'pending',
      ...(reference ? { reference } : {}),
      recordedBy: actor.id,
    });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'payment.recorded',
      resourceType: 'Order',
      resourceId: orderId,
      summary: { method, amount, status: 'pending' },
    });
    return entry;
  }

  /** Staff verifies or rejects a pending mobile payment. */
  async verifyPayment(
    entryId: string,
    decision: 'verified' | 'rejected',
    actor: PaymentActor,
  ): Promise<PaymentEntry> {
    if (!isStaff(actor)) throw new ForbiddenError('Only staff can verify payments.');
    const entry = await this.deps.payments.findById(entryId);
    if (!entry) throw new NotFoundError('Payment entry not found.');
    if (entry.status === decision) return entry; // idempotent
    const resolved = await this.deps.payments.resolvePending(
      entryId,
      decision,
      actor.id,
      this.now(),
    );
    await this.deps.audit.record({
      actor: actor.id,
      action: `payment.${decision}`,
      resourceType: 'Order',
      resourceId: entry.orderId,
      summary: { entryId, amount: entry.amount, method: entry.method },
    });
    return resolved;
  }

  /** Records a COD cash collection (verified on collection); idempotent. */
  async recordCodCollection(
    orderId: string,
    amount: number,
    expectedAmount: number,
    actor: PaymentActor,
    idempotencyKey?: string,
  ): Promise<PaymentEntry> {
    assertMinor(amount, 'amount');
    return runIdempotent<PaymentEntry>(
      this.deps.idempotency,
      {
        scope: `payment.cod:${orderId}`,
        key: idempotencyKey,
        requestHash: hashRequest({ orderId, amount, expectedAmount }),
      },
      async () => {
        const now = this.now();
        const entry = await this.deps.payments.create({
          orderId,
          method: 'cod',
          type: 'collection',
          amount,
          currency: CURRENCY,
          status: 'verified',
          expectedAmount,
          recordedBy: actor.id,
          verifiedBy: actor.id,
          verifiedAt: now,
        });
        await this.deps.audit.record({
          actor: actor.id,
          action: 'payment.cod_collected',
          resourceType: 'Order',
          resourceId: orderId,
          summary: { amount, expectedAmount, reconciled: amount === expectedAmount },
        });
        return entry;
      },
    );
  }

  /** Records an authorized refund; cannot exceed the net collected amount. */
  async recordRefund(
    orderId: string,
    method: PaymentMethod,
    amount: number,
    actor: PaymentActor,
    reference?: string,
  ): Promise<PaymentEntry> {
    if (!isStaff(actor)) throw new ForbiddenError('Only staff can issue refunds.');
    assertMinor(amount, 'amount');
    if (amount <= 0) throw new ValidationError('Refund amount must be positive.');

    const balance = computeBalance(await this.deps.payments.listByOrder(orderId), 0);
    if (balance.refunded + amount > balance.collected) {
      throw new ConflictError('Refund would exceed the collected amount.');
    }

    const now = this.now();
    const entry = await this.deps.payments.create({
      orderId,
      method,
      type: 'refund',
      amount,
      currency: CURRENCY,
      status: 'verified',
      ...(reference ? { reference } : {}),
      recordedBy: actor.id,
      verifiedBy: actor.id,
      verifiedAt: now,
    });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'payment.refunded',
      resourceType: 'Order',
      resourceId: orderId,
      summary: { method, amount },
    });
    return entry;
  }
}
