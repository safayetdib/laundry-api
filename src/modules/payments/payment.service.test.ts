import { describe, it, expect } from 'vitest';
import { PaymentService } from './payment.service';
import { InMemoryPaymentRepository } from './payment.repository';
import { InMemoryAuditRepository } from '../audit/audit.repository';
import { InMemoryIdempotencyRepository } from '../idempotency/idempotency.repository';
import type { PaymentActor } from './payment.service';

const ops: PaymentActor = { id: 'ops-1', roles: ['operations'] };
const customer: PaymentActor = { id: 'cust-1', roles: ['customer'] };
const ORDER = 'order-1';

function setup() {
  const payments = new InMemoryPaymentRepository();
  const service = new PaymentService({
    payments,
    audit: new InMemoryAuditRepository(),
    idempotency: new InMemoryIdempotencyRepository(),
  });
  return { payments, service };
}

describe('PaymentService', () => {
  it('keeps a manual payment pending until verified', async () => {
    const { service } = setup();
    const entry = await service.recordManualPayment(ORDER, 'bkash', 20000, customer, 'TRX1');
    expect(entry.status).toBe('pending');

    let balance = await service.getBalance(ORDER, 20000);
    expect(balance.state).toBe('unpaid');
    expect(balance.pendingVerification).toBe(20000);

    await service.verifyPayment(entry.id, 'verified', ops);
    balance = await service.getBalance(ORDER, 20000);
    expect(balance.netPaid).toBe(20000);
    expect(balance.state).toBe('paid');
  });

  it('forbids a non-staff user from verifying', async () => {
    const { service } = setup();
    const entry = await service.recordManualPayment(ORDER, 'nagad', 5000, customer);
    await expect(service.verifyPayment(entry.id, 'verified', customer)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('records COD collection idempotently (no double count)', async () => {
    const { service } = setup();
    await service.recordCodCollection(ORDER, 10000, 10000, ops, 'task-1');
    await service.recordCodCollection(ORDER, 10000, 10000, ops, 'task-1');

    const entries = await service.listForOrder(ORDER);
    expect(entries).toHaveLength(1);
    const balance = await service.getBalance(ORDER, 10000);
    expect(balance.collected).toBe(10000);
    expect(balance.state).toBe('paid');
  });

  it('prevents over-refunding beyond the collected amount', async () => {
    const { service } = setup();
    await service.recordCodCollection(ORDER, 10000, 10000, ops, 'task-1');
    await expect(service.recordRefund(ORDER, 'cod', 12000, ops)).rejects.toMatchObject({
      statusCode: 409,
    });
    const refund = await service.recordRefund(ORDER, 'cod', 4000, ops);
    expect(refund.type).toBe('refund');

    const balance = await service.getBalance(ORDER, 10000);
    expect(balance.refunded).toBe(4000);
    expect(balance.netPaid).toBe(6000);
  });

  it('reports partial payment state', async () => {
    const { service } = setup();
    const entry = await service.recordManualPayment(ORDER, 'bkash', 5000, customer);
    await service.verifyPayment(entry.id, 'verified', ops);
    const balance = await service.getBalance(ORDER, 20000);
    expect(balance.state).toBe('partial');
    expect(balance.outstanding).toBe(15000);
  });

  it('verify is idempotent', async () => {
    const { service } = setup();
    const entry = await service.recordManualPayment(ORDER, 'bkash', 5000, customer);
    await service.verifyPayment(entry.id, 'verified', ops);
    const again = await service.verifyPayment(entry.id, 'verified', ops);
    expect(again.status).toBe('verified');
  });
});
