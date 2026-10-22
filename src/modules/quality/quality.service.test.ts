import { describe, it, expect } from 'vitest';
import { buildTestApp } from '../../test/factory';
import type { OrderActor } from '../orders/order.service';

const customer: OrderActor = { id: 'cust-1', roles: ['customer'] };
const other: OrderActor = { id: 'cust-2', roles: ['customer'] };
const ops: OrderActor = { id: 'ops-1', roles: ['operations'] };

async function setupOrder() {
  const ctx = buildTestApp();
  await ctx.services.create({ code: 'wash_fold', name: 'Wash & Fold', pricingUnit: 'item' });
  const list = await ctx.pricingService.createPriceList(
    {
      kind: 'customer',
      name: 'prices',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      entries: [{ serviceCode: 'wash_fold', unitAmount: 5000 }],
    },
    'admin',
  );
  await ctx.pricingService.publishPriceList(list.id, 'admin');
  const zone = await ctx.zones.create({
    code: 'ctg',
    name: 'Central',
    city: 'Chattogram',
    slotTemplates: [{ type: 'pickup', label: 'AM', startHour: 9, endHour: 12, capacity: 20 }],
  });
  const order = await ctx.orderService.createOrder(
    {
      addressSnapshot: {
        contactName: 'R',
        phone: '+8801712345678',
        line1: 'x',
        area: 'y',
        city: 'Chattogram',
      },
      zoneId: zone.id,
      items: [{ serviceCode: 'wash_fold', quantity: 2 }],
      pickupStart: '2026-06-01T09:00:00.000Z',
    },
    customer,
  );
  return { ctx, order };
}

describe('QualityService', () => {
  it('lets the order customer open a case and staff resolve it', async () => {
    const { ctx, order } = await setupOrder();
    const created = await ctx.qualityService.createCase(
      { orderId: order.id, type: 'damage', description: 'Button missing' },
      customer,
    );
    expect(created.status).toBe('open');

    const resolved = await ctx.qualityService.updateCase(
      created.id,
      { status: 'resolved', resolution: 'Compensated' },
      ops,
    );
    expect(resolved.status).toBe('resolved');
  });

  it('forbids a non-owner from opening a case', async () => {
    const { ctx, order } = await setupOrder();
    await expect(
      ctx.qualityService.createCase(
        { orderId: order.id, type: 'complaint', description: 'x' },
        other,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('forbids a customer from resolving a case', async () => {
    const { ctx, order } = await setupOrder();
    const created = await ctx.qualityService.createCase(
      { orderId: order.id, type: 'rework', description: 'Still stained' },
      customer,
    );
    await expect(
      ctx.qualityService.updateCase(created.id, { status: 'resolved' }, customer),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
