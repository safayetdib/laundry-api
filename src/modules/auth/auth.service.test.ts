import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service';
import { InMemoryUserRepository } from '../users/user.repository';
import { InMemorySessionRepository } from './session.repository';
import { AppError } from '../../lib/errors';

function setup(ttlMs = 60 * 60 * 1000) {
  const clock = { now: new Date('2026-01-01T00:00:00Z') };
  const service = new AuthService({
    users: new InMemoryUserRepository(),
    sessions: new InMemorySessionRepository(),
    sessionTtlMs: ttlMs,
    now: () => clock.now,
  });
  return { service, clock };
}

const base = { name: 'Rahim', phone: '01712345678', password: 'hunter2hunter2' };

describe('AuthService.createUser', () => {
  it('creates a customer and normalizes the phone', async () => {
    const { service } = setup();
    const user = await service.createUser(base);
    expect(user.phone).toBe('+8801712345678');
    expect(user.roles).toEqual(['customer']);
  });

  it('rejects a duplicate phone with a conflict', async () => {
    const { service } = setup();
    await service.createUser(base);
    await expect(service.createUser(base)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects an invalid phone', async () => {
    const { service } = setup();
    await expect(service.createUser({ ...base, phone: '123' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('requires a partnerId for partner_staff', async () => {
    const { service } = setup();
    await expect(service.createUser({ ...base, roles: ['partner_staff'] })).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe('AuthService.login / validateSession', () => {
  it('logs in with valid credentials and validates the session', async () => {
    const { service } = setup();
    await service.createUser(base);

    const { token } = await service.login(base.phone, base.password);
    const result = await service.validateSession(token);
    expect(result?.user.phone).toBe('+8801712345678');
  });

  it('rejects a wrong password with 401', async () => {
    const { service } = setup();
    await service.createUser(base);
    await expect(service.login(base.phone, 'wrong')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an unknown phone with 401', async () => {
    const { service } = setup();
    await expect(service.login('01700000000', 'whatever')).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('rejects a suspended user with 403', async () => {
    const { service } = setup();
    await service.createUser({ ...base, status: 'suspended' });
    await expect(service.login(base.phone, base.password)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('returns null for an expired session', async () => {
    const { service, clock } = setup(1000);
    await service.createUser(base);
    const { token } = await service.login(base.phone, base.password);

    clock.now = new Date(clock.now.getTime() + 2000);
    expect(await service.validateSession(token)).toBeNull();
  });

  it('returns null after logout (revocation)', async () => {
    const { service } = setup();
    await service.createUser(base);
    const { token } = await service.login(base.phone, base.password);

    await service.logout(token);
    expect(await service.validateSession(token)).toBeNull();
  });
});
