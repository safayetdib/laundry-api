import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';

describe('OTP routes', () => {
  it('accepts an OTP request without revealing account existence', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/v1/auth/request-otp').send({ phone: '01712345678' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('sent');
  });

  it('rejects an invalid phone on request with 400', async () => {
    const { app } = buildTestApp();
    const res = await request(app).post('/api/v1/auth/request-otp').send({ phone: '123' });
    expect(res.status).toBe(400);
  });

  it('rejects verification when no code was issued', async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: '01712345678', code: '000000' });
    expect(res.status).toBe(401);
  });
});
