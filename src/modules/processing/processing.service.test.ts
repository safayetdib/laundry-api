import { describe, it, expect } from 'vitest';
import { buildTestApp } from '../../test/factory';
import type { OrderActor } from '../orders/order.service';
import type { AssignmentActor } from '../assignments/assignment.service';

const customer: OrderActor = { id: 'cust-1', roles: ['customer'] };
const ops: OrderActor = { id: 'ops-1', roles: ['operations'] };

async function setupAcceptedAssignment() {
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
    name: 'Pilot',
    serviceCodes: ['wash_fold'],
    zoneIds: [zone.id],
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
  const assignment = await ctx.assignmentService.createAssignment(
    confirmed.id,
    partner.id,
    [{ orderItemId, serviceCode: 'wash_fold', quantity: 10 }],
    ops,
  );
  const accepted = await ctx.assignmentService.updateStatus(
    assignment.id,
    'accepted',
    partnerActor,
  );
  return { ctx, order: confirmed, orderItemId, assignment: accepted, partnerActor };
}

describe('ProcessingService.recordIntake', () => {
  it('records a clean intake and an append-only handover event', async () => {
    const { ctx, order, orderItemId, assignment, partnerActor } = await setupAcceptedAssignment();
    const result = await ctx.processingService.recordIntake(
      assignment.id,
      { receivedItems: [{ orderItemId, quantity: 10 }] },
      partnerActor,
    );

    expect(result.status).toBe('received');
    expect(result.intake?.discrepancies).toEqual([]);
    // Expected quantity is preserved on items; received on intake.
    expect(result.items[0]!.quantity).toBe(10);
    expect(result.intake?.receivedItems[0]).toEqual({ orderItemId, quantity: 10 });

    const events = await ctx.handovers.listByOrder(order.id);
    expect(events.some((e) => e.type === 'intake')).toBe(true);
  });

  it('records discrepancies without overwriting the expected quantity', async () => {
    const { ctx, orderItemId, assignment, partnerActor } = await setupAcceptedAssignment();
    const result = await ctx.processingService.recordIntake(
      assignment.id,
      { receivedItems: [{ orderItemId, quantity: 8 }] },
      partnerActor,
    );

    expect(result.items[0]!.quantity).toBe(10); // expected preserved
    expect(result.intake?.discrepancies).toEqual([{ orderItemId, expected: 10, received: 8 }]);
  });

  it('forbids intake by a different partner', async () => {
    const { ctx, orderItemId, assignment } = await setupAcceptedAssignment();
    const intruder: AssignmentActor = { id: 'ps-x', roles: ['partner_staff'], partnerId: 'other' };
    await expect(
      ctx.processingService.recordIntake(
        assignment.id,
        { receivedItems: [{ orderItemId, quantity: 10 }] },
        intruder,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects an unknown order item', async () => {
    const { ctx, assignment, partnerActor } = await setupAcceptedAssignment();
    await expect(
      ctx.processingService.recordIntake(
        assignment.id,
        { receivedItems: [{ orderItemId: 'nope', quantity: 1 }] },
        partnerActor,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('cannot take intake before the assignment is accepted', async () => {
    // Fresh setup, but reject the accepted assignment and create a new,
    // still-'assigned' one so intake is attempted from the wrong state.
    const { ctx, order, orderItemId, assignment, partnerActor } = await setupAcceptedAssignment();
    await ctx.assignmentService.updateStatus(assignment.id, 'rejected', partnerActor);
    const partner = assignment.partnerId;
    const fresh = await ctx.assignmentService.createAssignment(
      order.id,
      partner,
      [{ orderItemId, serviceCode: 'wash_fold', quantity: 10 }],
      ops,
    );

    await expect(
      ctx.processingService.recordIntake(
        fresh.id,
        { receivedItems: [{ orderItemId, quantity: 10 }] },
        partnerActor,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
