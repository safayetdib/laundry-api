import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';

describe('zone routes', () => {
  it('lists active zones', async () => {
    const ctx = buildTestApp();
    await ctx.zones.create({ code: 'ctg-central', name: 'Central', city: 'Chattogram' });

    const res = await request(ctx.app).get('/api/v1/zones');
    expect(res.status).toBe(200);
    expect(res.body.data[0].code).toBe('ctg-central');
  });

  it('returns availability slots for a zone and date', async () => {
    const ctx = buildTestApp();
    const zone = await ctx.zones.create({
      code: 'ctg-central',
      name: 'Central',
      city: 'Chattogram',
      slotTemplates: [{ type: 'pickup', label: 'AM', startHour: 9, endHour: 12, capacity: 5 }],
    });

    const res = await request(ctx.app)
      .get('/api/v1/zones/availability')
      .query({ zoneId: zone.id, date: '2026-06-01' });

    expect(res.status).toBe(200);
    expect(res.body.data.slots).toHaveLength(1);
    expect(res.body.data.slots[0].capacity).toBe(5);
  });

  it('404s for an unknown zone', async () => {
    const ctx = buildTestApp();
    const res = await request(ctx.app)
      .get('/api/v1/zones/availability')
      .query({ zoneId: 'missing', date: '2026-06-01' });
    expect(res.status).toBe(404);
  });

  it('400s for a malformed date', async () => {
    const ctx = buildTestApp();
    const res = await request(ctx.app)
      .get('/api/v1/zones/availability')
      .query({ zoneId: 'x', date: 'not-a-date' });
    expect(res.status).toBe(400);
  });
});
