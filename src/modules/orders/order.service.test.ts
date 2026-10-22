import { describe, it, expect } from 'vitest';
import { buildTestApp } from '../../test/factory';
import type { OrderActor } from './order.service';

const customer1: OrderActor = { id: 'cust-1', roles: ['customer'] };
const customer2: OrderActor = { id: 'cust-2', roles: ['customer'] };
const ops: OrderActor = { id: 'ops-1', roles: ['operations'] };

const PICKUP = '2026-06-01T09:00:00.000Z';
const address = {
  contactName: 'Rahim',
  phone: '+8801712345678',
  line1: '12 Road 3',
  area: 'Agrabad',
  city: 'Chattogram',
};

async function setup(capacity = 5) {
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
    slotTemplates: [{ type: 'pickup', label: 'AM', startHour: 9, endHour: 12, capacity }],
  });
  return { ctx, zone };
}

function orderInput(zoneId: string) {
  return {
    addressSnapshot: address,
    zoneId,
    items: [{ serviceCode: 'wash_fold', quantity: 2 }],
    pickupStart: PICKUP,
    deliveryFee: 6000,
  };
}

describe('OrderService', () => {
  it('creates an order with a pending quote and reserves the slot', async () => {
    const { ctx, zone } = await setup();
    const order = await ctx.orderService.createOrder(orderInput(zone.id), customer1);

    expect(order.status).toBe('pending_confirmation');
    expect(order.quote.status).toBe('pending_approval');
    expect(order.quote.subtotal).toBe(10000);
    expect(order.quote.total).toBe(16000);
    expect(await ctx.slotRepo.reservedCount(order.pickup.slotKey)).toBe(1);
  });

  it('is idempotent for the same key and rejects key reuse with a different body', async () => {
    const { ctx, zone } = await setup();
    const a = await ctx.orderService.createOrder(orderInput(zone.id), customer1, 'key-1');
    const b = await ctx.orderService.createOrder(orderInput(zone.id), customer1, 'key-1');
    expect(b.id).toBe(a.id);

    const different = { ...orderInput(zone.id), deliveryFee: 9000 };
    await expect(ctx.orderService.createOrder(different, customer1, 'key-1')).rejects.toMatchObject(
      { statusCode: 409 },
    );
  });

  it('does not oversell a slot across concurrent customers', async () => {
    const { ctx, zone } = await setup(1);
    await ctx.orderService.createOrder(orderInput(zone.id), customer1);
    await expect(
      ctx.orderService.createOrder(orderInput(zone.id), customer2),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a stale quote version on approval', async () => {
    const { ctx, zone } = await setup();
    const order = await ctx.orderService.createOrder(orderInput(zone.id), customer1);
    await expect(ctx.orderService.approveQuote(order.id, 99, customer1)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('enforces the approve -> confirm sequence and staff-only confirmation', async () => {
    const { ctx, zone } = await setup();
    const order = await ctx.orderService.createOrder(orderInput(zone.id), customer1);

    // Customer cannot confirm.
    await expect(ctx.orderService.confirmOrder(order.id, customer1)).rejects.toMatchObject({
      statusCode: 403,
    });
    // Staff cannot confirm before approval.
    await expect(ctx.orderService.confirmOrder(order.id, ops)).rejects.toMatchObject({
      statusCode: 422,
    });

    const approved = await ctx.orderService.approveQuote(order.id, 1, customer1);
    expect(approved.quote.status).toBe('approved');

    const confirmed = await ctx.orderService.confirmOrder(order.id, ops);
    expect(confirmed.status).toBe('confirmed');
  });

  it('releases the slot when an order is cancelled', async () => {
    const { ctx, zone } = await setup(1);
    const order = await ctx.orderService.createOrder(orderInput(zone.id), customer1);
    expect(await ctx.slotRepo.reservedCount(order.pickup.slotKey)).toBe(1);

    await ctx.orderService.cancelOrder(order.id, customer1);
    expect(await ctx.slotRepo.reservedCount(order.pickup.slotKey)).toBe(0);

    // Capacity is available again.
    await expect(
      ctx.orderService.createOrder(orderInput(zone.id), customer2),
    ).resolves.toBeTruthy();
  });

  it('hides orders from other customers', async () => {
    const { ctx, zone } = await setup();
    const order = await ctx.orderService.createOrder(orderInput(zone.id), customer1);
    await expect(ctx.orderService.getByCode(order.orderCode, customer2)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
