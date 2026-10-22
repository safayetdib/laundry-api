import { describe, it, expect } from 'vitest';
import { buildTestApp } from '../../test/factory';
import type { OrderActor } from '../orders/order.service';
import type { DeliveryActor } from './delivery.service';

const customer: OrderActor = { id: 'cust-1', roles: ['customer'] };
const ops: DeliveryActor & OrderActor = { id: 'ops-1', roles: ['operations'] };
const rider: DeliveryActor = { id: 'rider-1', roles: ['rider'] };

async function setupConfirmedOrder() {
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
  await ctx.orderService.approveQuote(order.id, 1, customer);
  const confirmed = await ctx.orderService.confirmOrder(order.id, ops);
  return { ctx, order: confirmed, orderItemId: confirmed.quote.lines[0]!.orderItemId };
}

const WINDOW = {
  scheduledStart: '2026-06-02T17:00:00.000Z',
  scheduledEnd: '2026-06-02T20:00:00.000Z',
};

describe('DeliveryService lifecycle', () => {
  it('drives pickup -> delivery with COD capture', async () => {
    const { ctx, order, orderItemId } = await setupConfirmedOrder();

    const pickup = await ctx.deliveryService.createPickupTask(order.id, ops, rider.id);
    expect(pickup.status).toBe('scheduled');

    const pickedUp = await ctx.deliveryService.completePickup(
      pickup.id,
      { counts: [{ orderItemId, quantity: 2 }] },
      rider,
    );
    expect(pickedUp.status).toBe('completed');

    // Operations advances the partner-side micro-states.
    await ctx.orderService.advance(order.id, 'in_service', ops);
    await ctx.orderService.advance(order.id, 'ready_for_delivery', ops);

    const deliveryTask = await ctx.deliveryService.createDeliveryTask(
      order.id,
      ops,
      WINDOW,
      rider.id,
    );
    const total = order.quote.total;
    const delivered = await ctx.deliveryService.completeDelivery(
      deliveryTask.id,
      { codAmountCollected: total },
      rider,
    );
    expect(delivered.status).toBe('completed');
    expect(delivered.codAmountCollected).toBe(total);

    const balance = await ctx.paymentService.getBalance(order.id, total);
    expect(balance.state).toBe('paid');
  });

  it('returns the order to ready_for_delivery on a failed delivery', async () => {
    const { ctx, order, orderItemId } = await setupConfirmedOrder();
    const pickup = await ctx.deliveryService.createPickupTask(order.id, ops, rider.id);
    await ctx.deliveryService.completePickup(
      pickup.id,
      { counts: [{ orderItemId, quantity: 2 }] },
      rider,
    );
    await ctx.orderService.advance(order.id, 'in_service', ops);
    await ctx.orderService.advance(order.id, 'ready_for_delivery', ops);
    const task = await ctx.deliveryService.createDeliveryTask(order.id, ops, WINDOW, rider.id);

    const failed = await ctx.deliveryService.failDelivery(task.id, 'customer unavailable', rider);
    expect(failed.status).toBe('failed');
    expect(failed.attempts).toBe(1);

    const refetched = await ctx.orders.findById(order.id);
    expect(refetched?.status).toBe('ready_for_delivery');
  });

  it("forbids a rider from completing another rider's task", async () => {
    const { ctx, order, orderItemId } = await setupConfirmedOrder();
    const pickup = await ctx.deliveryService.createPickupTask(order.id, ops, rider.id);
    const intruder: DeliveryActor = { id: 'rider-2', roles: ['rider'] };
    await expect(
      ctx.deliveryService.completePickup(
        pickup.id,
        { counts: [{ orderItemId, quantity: 2 }] },
        intruder,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
