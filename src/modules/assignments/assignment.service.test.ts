import { describe, it, expect } from 'vitest';
import { buildTestApp } from '../../test/factory';
import type { OrderActor } from '../orders/order.service';
import type { AssignmentActor } from './assignment.service';

const customer: OrderActor = { id: 'cust-1', roles: ['customer'] };
const ops: OrderActor = { id: 'ops-1', roles: ['operations'] };

async function setupConfirmedOrder(
  opts: { partnerServices?: string[]; partnerZones?: string[] } = {},
) {
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
  const partner = await ctx.partners.create({
    code: 'P1',
    name: 'Pilot Laundry',
    serviceCodes: opts.partnerServices ?? ['wash_fold'],
    zoneIds: opts.partnerZones ?? [zone.id],
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
      items: [{ serviceCode: 'wash_fold', quantity: 10 }],
      pickupStart: '2026-06-01T09:00:00.000Z',
    },
    customer,
  );
  await ctx.orderService.approveQuote(order.id, 1, customer);
  const confirmed = await ctx.orderService.confirmOrder(order.id, ops);
  const orderItemId = confirmed.quote.lines[0]!.orderItemId;

  const partnerActor: AssignmentActor = {
    id: 'ps-1',
    roles: ['partner_staff'],
    partnerId: partner.id,
  };
  return { ctx, zone, partner, order: confirmed, orderItemId, partnerActor };
}

describe('AssignmentService', () => {
  it('assigns within confirmed quantity and enforces the allocation cap', async () => {
    const { ctx, order, orderItemId, partner } = await setupConfirmedOrder();

    const first = await ctx.assignmentService.createAssignment(
      order.id,
      partner.id,
      [{ orderItemId, serviceCode: 'wash_fold', quantity: 4 }],
      ops,
    );
    expect(first.status).toBe('assigned');

    await ctx.assignmentService.createAssignment(
      order.id,
      partner.id,
      [{ orderItemId, serviceCode: 'wash_fold', quantity: 6 }],
      ops,
    );

    await expect(
      ctx.assignmentService.createAssignment(
        order.id,
        partner.id,
        [{ orderItemId, serviceCode: 'wash_fold', quantity: 1 }],
        ops,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects a partner that does not serve the zone or service', async () => {
    const noZone = await setupConfirmedOrder({ partnerZones: ['other-zone'] });
    await expect(
      noZone.ctx.assignmentService.createAssignment(
        noZone.order.id,
        noZone.partner.id,
        [{ orderItemId: noZone.orderItemId, serviceCode: 'wash_fold', quantity: 1 }],
        ops,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    const noService = await setupConfirmedOrder({ partnerServices: ['iron'] });
    await expect(
      noService.ctx.assignmentService.createAssignment(
        noService.order.id,
        noService.partner.id,
        [{ orderItemId: noService.orderItemId, serviceCode: 'wash_fold', quantity: 1 }],
        ops,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('frees quantity when an assignment is rejected', async () => {
    const { ctx, order, orderItemId, partner, partnerActor } = await setupConfirmedOrder();
    const a = await ctx.assignmentService.createAssignment(
      order.id,
      partner.id,
      [{ orderItemId, serviceCode: 'wash_fold', quantity: 10 }],
      ops,
    );
    await ctx.assignmentService.updateStatus(a.id, 'rejected', partnerActor);

    // Full quantity is available again.
    await expect(
      ctx.assignmentService.createAssignment(
        order.id,
        partner.id,
        [{ orderItemId, serviceCode: 'wash_fold', quantity: 10 }],
        ops,
      ),
    ).resolves.toBeTruthy();
  });

  it('enforces partner scope on status transitions', async () => {
    const { ctx, order, orderItemId, partner } = await setupConfirmedOrder();
    const a = await ctx.assignmentService.createAssignment(
      order.id,
      partner.id,
      [{ orderItemId, serviceCode: 'wash_fold', quantity: 1 }],
      ops,
    );

    const otherPartner: AssignmentActor = {
      id: 'ps-2',
      roles: ['partner_staff'],
      partnerId: 'different-partner',
    };
    await expect(
      ctx.assignmentService.updateStatus(a.id, 'accepted', otherPartner),
    ).rejects.toMatchObject({
      statusCode: 403,
    });

    const owner: AssignmentActor = { id: 'ps-1', roles: ['partner_staff'], partnerId: partner.id };
    const accepted = await ctx.assignmentService.updateStatus(a.id, 'accepted', owner);
    expect(accepted.status).toBe('accepted');
  });
});
