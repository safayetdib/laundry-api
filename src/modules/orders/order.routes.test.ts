import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';

const customer = { phone: '01712345678', password: 'cust-pass-123' };
const staff = { phone: '01710000000', password: 'ops-pass-1234' };

const orderBody = {
  addressSnapshot: {
    contactName: 'Rahim',
    phone: '+8801712345678',
    line1: '12 Road 3',
    area: 'Agrabad',
    city: 'Chattogram',
  },
  zoneId: '',
  items: [{ serviceCode: 'wash_fold', quantity: 2 }],
  pickupStart: '2026-06-01T09:00:00.000Z',
  deliveryFee: 6000,
};

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
    slotTemplates: [{ type: 'pickup', label: 'AM', startHour: 9, endHour: 12, capacity: 5 }],
  });
  await ctx.authService.createUser({ name: 'Rahim', ...customer, roles: ['customer'] });
  await ctx.authService.createUser({ name: 'Ops', ...staff, roles: ['operations'] });
  return { ctx, zone };
}

async function login(app: ReturnType<typeof buildTestApp>['app'], creds: typeof customer) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send(creds);
  return { agent, csrf: res.body.data.csrfToken as string };
}

describe('order routes', () => {
  it('runs the create -> approve -> confirm flow', async () => {
    const { ctx, zone } = await setup();
    const body = { ...orderBody, zoneId: zone.id };

    const { agent, csrf } = await login(ctx.app, customer);
    const created = await agent
      .post('/api/v1/orders')
      .set('x-csrf-token', csrf)
      .set('Idempotency-Key', 'order-key-1')
      .send(body);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('pending_confirmation');
    const { id, orderCode } = created.body.data;

    // Idempotent replay returns the same order.
    const replay = await agent
      .post('/api/v1/orders')
      .set('x-csrf-token', csrf)
      .set('Idempotency-Key', 'order-key-1')
      .send(body);
    expect(replay.body.data.id).toBe(id);

    const fetched = await agent.get(`/api/v1/orders/${orderCode}`);
    expect(fetched.status).toBe(200);

    const approved = await agent
      .post(`/api/v1/orders/${id}/approve-quote`)
      .set('x-csrf-token', csrf)
      .send({ quoteVersion: 1 });
    expect(approved.status).toBe(200);
    expect(approved.body.data.quote.status).toBe('approved');

    const staffSession = await login(ctx.app, staff);
    const confirmed = await staffSession.agent
      .post(`/api/v1/orders/${id}/confirm`)
      .set('x-csrf-token', staffSession.csrf);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe('confirmed');
  });

  it('requires authentication and CSRF to create an order', async () => {
    const { ctx, zone } = await setup();
    const body = { ...orderBody, zoneId: zone.id };

    const anon = await request(ctx.app).post('/api/v1/orders').send(body);
    expect(anon.status).toBe(401);

    const { agent } = await login(ctx.app, customer);
    const noCsrf = await agent.post('/api/v1/orders').send(body);
    expect(noCsrf.status).toBe(403);
  });
});
