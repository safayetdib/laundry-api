import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';

const adminCreds = { phone: '01710000000', password: 'admin-pass-123' };
const customerCreds = { phone: '01720000000', password: 'cust-pass-123' };

async function setup() {
  const ctx = buildTestApp();
  await ctx.services.create({ code: 'wash_fold', name: 'Wash & Fold', pricingUnit: 'item' });
  await ctx.authService.createUser({ name: 'Admin', ...adminCreds, roles: ['admin'] });
  await ctx.authService.createUser({ name: 'Cust', ...customerCreds, roles: ['customer'] });
  return ctx;
}

async function loginAgent(app: ReturnType<typeof buildTestApp>['app'], creds: typeof adminCreds) {
  const agent = request.agent(app);
  const res = await agent.post('/api/v1/auth/login').send(creds);
  return { agent, csrfToken: res.body.data.csrfToken as string };
}

const listBody = {
  kind: 'customer',
  name: 'Pilot customer prices',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  entries: [{ serviceCode: 'wash_fold', unitAmount: 5000 }],
};

describe('pricing routes', () => {
  it('lets an admin create and publish a price list, then shows it in /pricing', async () => {
    const ctx = await setup();
    const { agent, csrfToken } = await loginAgent(ctx.app, adminCreds);

    const created = await agent
      .post('/api/v1/admin/price-lists')
      .set('x-csrf-token', csrfToken)
      .send(listBody);
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('draft');

    const published = await agent
      .post(`/api/v1/admin/price-lists/${created.body.data.id}/publish`)
      .set('x-csrf-token', csrfToken);
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('published');

    const pricing = await request(ctx.app).get('/api/v1/pricing');
    expect(pricing.status).toBe(200);
    const wash = pricing.body.data.services.find(
      (s: { serviceCode: string }) => s.serviceCode === 'wash_fold',
    );
    expect(wash.unitAmount).toBe(5000);
  });

  it('rejects price-list creation without authentication (401)', async () => {
    const ctx = await setup();
    const res = await request(ctx.app).post('/api/v1/admin/price-lists').send(listBody);
    expect(res.status).toBe(401);
  });

  it('forbids a customer from creating a price list (403)', async () => {
    const ctx = await setup();
    const { agent, csrfToken } = await loginAgent(ctx.app, customerCreds);
    const res = await agent
      .post('/api/v1/admin/price-lists')
      .set('x-csrf-token', csrfToken)
      .send(listBody);
    expect(res.status).toBe(403);
  });

  it('returns an empty preview when no prices are published', async () => {
    const ctx = await setup();
    const res = await request(ctx.app).get('/api/v1/pricing');
    expect(res.status).toBe(200);
    expect(res.body.data.services).toEqual([]);
  });
});
