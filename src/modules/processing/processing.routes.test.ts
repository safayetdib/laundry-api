import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';

async function login(
  app: ReturnType<typeof buildTestApp>['app'],
  creds: { phone: string; password: string },
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send(creds);
  return { agent, csrf: res.body.data.csrfToken as string };
}

const customer = { phone: '01712345678', password: 'cust-pass-1' };
const admin = { phone: '01710000000', password: 'admin-pass-1' };
const partnerStaff = { phone: '01720000000', password: 'partner-pass-1' };

describe('processing + handover routes (end-to-end)', () => {
  it('runs booking -> assign -> accept -> intake and exposes handover history', async () => {
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
    await ctx.authService.createUser({ name: 'Cust', ...customer, roles: ['customer'] });
    await ctx.authService.createUser({ name: 'Admin', ...admin, roles: ['admin'] });
    await ctx.authService.createUser({
      name: 'PS',
      ...partnerStaff,
      roles: ['partner_staff'],
      partnerId: partner.id,
    });

    const cust = await login(ctx.app, customer);
    const created = await cust.agent
      .post('/api/v1/orders')
      .set('x-csrf-token', cust.csrf)
      .send({
        addressSnapshot: {
          contactName: 'R',
          phone: '+8801712345678',
          line1: 'x',
          area: 'y',
          city: 'Chattogram',
        },
        zoneId: zone.id,
        items: [{ serviceCode: 'wash_fold', quantity: 3 }],
        pickupStart: '2026-06-01T09:00:00.000Z',
      });
    expect(created.status).toBe(201);
    const { id: orderId, orderCode } = created.body.data;
    const orderItemId = created.body.data.quote.lines[0].orderItemId;

    await cust.agent
      .post(`/api/v1/orders/${orderId}/approve-quote`)
      .set('x-csrf-token', cust.csrf)
      .send({ quoteVersion: 1 });

    const adm = await login(ctx.app, admin);
    await adm.agent.post(`/api/v1/orders/${orderId}/confirm`).set('x-csrf-token', adm.csrf);
    const assigned = await adm.agent
      .post(`/api/v1/admin/orders/${orderId}/assignments`)
      .set('x-csrf-token', adm.csrf)
      .send({
        partnerId: partner.id,
        items: [{ orderItemId, serviceCode: 'wash_fold', quantity: 3 }],
      });
    const assignmentId = assigned.body.data.id;

    const ps = await login(ctx.app, partnerStaff);
    await ps.agent
      .post(`/api/v1/partner/assignments/${assignmentId}/accept`)
      .set('x-csrf-token', ps.csrf);
    const intake = await ps.agent
      .post(`/api/v1/partner/assignments/${assignmentId}/intake`)
      .set('x-csrf-token', ps.csrf)
      .send({ receivedItems: [{ orderItemId, quantity: 2 }], conditionNotes: 'one sock missing' });
    expect(intake.status).toBe(200);
    expect(intake.body.data.status).toBe('received');
    expect(intake.body.data.intake.discrepancies).toEqual([
      { orderItemId, expected: 3, received: 2 },
    ]);

    const history = await cust.agent.get(`/api/v1/orders/${orderCode}/handovers`);
    expect(history.status).toBe(200);
    expect(history.body.data.some((e: { type: string }) => e.type === 'intake')).toBe(true);
  });
});
