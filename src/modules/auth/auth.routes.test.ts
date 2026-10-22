import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { buildTestApp } from '../../test/factory';

const creds = { phone: '01712345678', password: 'hunter2hunter2' };

async function seeded() {
  const ctx = buildTestApp();
  await ctx.authService.createUser({ name: 'Rahim', ...creds });
  return ctx;
}

describe('auth routes', () => {
  it('logs in, sets cookies and returns the user + csrf token', async () => {
    const { app } = await seeded();
    const res = await request(app).post('/api/v1/auth/login').send(creds);

    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe('+8801712345678');
    expect(typeof res.body.data.csrfToken).toBe('string');

    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cookies = (setCookie ?? []).join(';');
    expect(cookies).toContain('folded_session=');
    expect(cookies).toContain('folded_csrf=');
    expect(cookies).toContain('HttpOnly'); // session cookie is HttpOnly
  });

  it('rejects a wrong password with 401', async () => {
    const { app } = await seeded();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ ...creds, password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('rejects a suspended account with 403', async () => {
    const ctx = buildTestApp();
    await ctx.authService.createUser({ name: 'S', ...creds, status: 'suspended' });
    const res = await request(ctx.app).post('/api/v1/auth/login').send(creds);
    expect(res.status).toBe(403);
  });

  it('GET /me requires authentication', async () => {
    const { app } = await seeded();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /me returns the current user when authenticated', async () => {
    const { app } = await seeded();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send(creds);

    const res = await agent.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe('+8801712345678');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('logout requires a CSRF token and then invalidates the session', async () => {
    const { app } = await seeded();
    const agent = request.agent(app);
    const login = await agent.post('/api/v1/auth/login').send(creds);
    const csrfToken = login.body.data.csrfToken as string;

    const noCsrf = await agent.post('/api/v1/auth/logout');
    expect(noCsrf.status).toBe(403);

    const ok = await agent.post('/api/v1/auth/logout').set('x-csrf-token', csrfToken);
    expect(ok.status).toBe(200);

    const after = await agent.get('/api/v1/auth/me');
    expect(after.status).toBe(401);
  });

  it('rate-limits repeated login attempts', async () => {
    const { app } = await seeded();
    let last = 200;
    for (let i = 0; i < 11; i += 1) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ ...creds, password: 'wrong' });
      last = res.status;
    }
    expect(last).toBe(429);
  });
});
