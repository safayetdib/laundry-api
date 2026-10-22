import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';

describe('GET /services', () => {
  it('lists active services sorted, excluding inactive ones', async () => {
    const ctx = buildTestApp();
    await ctx.services.create({ code: 'iron', name: 'Iron', pricingUnit: 'item', sortOrder: 2 });
    await ctx.services.create({
      code: 'wash_fold',
      name: 'Wash & Fold',
      pricingUnit: 'item',
      sortOrder: 1,
    });
    await ctx.services.create({
      code: 'dry',
      name: 'Dry Clean',
      pricingUnit: 'item',
      active: false,
    });

    const res = await request(ctx.app).get('/api/v1/services');
    expect(res.status).toBe(200);
    const codes = res.body.data.map((s: { code: string }) => s.code);
    expect(codes).toEqual(['wash_fold', 'iron']);
  });
});
