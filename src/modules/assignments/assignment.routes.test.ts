import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';
import type { OrderActor } from '../orders/order.service';

const customer: OrderActor = { id: 'cust-1', roles: ['customer'] };
const ops: OrderActor = { id: 'ops-1', roles: ['operations'] };

async function login(
  app: ReturnType<typeof buildTestApp>['app'],
  creds: { phone: string; password: string },
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send(creds);
  return { agent, csrf: res.body.data.csrfToken as string };
}

async function setup() {
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
      items: [{ serviceCode: 'wash_fold', quantity: 5 }],
      pickupStart: '2026-06-01T09:00:00.000Z',
    },
    customer,
  );
  await ctx.orderService.approveQuote(order.id, 1, customer);
  const confirmed = await ctx.orderService.confirmOrder(order.id, ops);

  await ctx.authService.createUser({
    name: 'Admin',
    phone: '01710000000',
    password: 'admin-pass-1',
    roles: ['admin'],
  });
  await ctx.authService.createUser({
    name: 'Partner Staff',
    phone: '01720000000',
    password: 'partner-pass-1',
    roles: ['partner_staff'],
    partnerId: partner.id,
  });

  return { ctx, partner, order: confirmed, orderItemId: confirmed.quote.lines[0]!.orderItemId };
}

describe('assignment routes', () => {
  it('admin assigns; partner staff lists and accepts their assignment', async () => {
    const { ctx, partner, order, orderItemId } = await setup();

    const admin = await login(ctx.app, { phone: '01710000000', password: 'admin-pass-1' });
    const assigned = await admin.agent
      .post(`/api/v1/admin/orders/${order.id}/assignments`)
      .set('x-csrf-token', admin.csrf)
      .send({
        partnerId: partner.id,
        items: [{ orderItemId, serviceCode: 'wash_fold', quantity: 5 }],
      });
    expect(assigned.status).toBe(201);
    const assignmentId = assigned.body.data.id;

    const partnerStaff = await login(ctx.app, { phone: '01720000000', password: 'partner-pass-1' });
    const list = await partnerStaff.agent.get('/api/v1/partner/assignments');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const accepted = await partnerStaff.agent
      .post(`/api/v1/partner/assignments/${assignmentId}/accept`)
      .set('x-csrf-token', partnerStaff.csrf);
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.status).toBe('accepted');
  });

  it('forbids a customer from listing partner assignments', async () => {
    const { ctx } = await setup();
    await ctx.authService.createUser({
      name: 'Cust',
      phone: '01730000000',
      password: 'cust-pass-1',
      roles: ['customer'],
    });
    const cust = await login(ctx.app, { phone: '01730000000', password: 'cust-pass-1' });
    const res = await cust.agent.get('/api/v1/partner/assignments');
    expect(res.status).toBe(403);
  });
});
