import { describe, it, expect } from 'vitest';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { InMemoryOtpRepository } from './otp.repository';
import { StubSmsSender } from './sms';
import { InMemoryUserRepository } from '../users/user.repository';
import { InMemorySessionRepository } from './session.repository';

const PHONE = '01712345678';

function setup() {
  const clock = { now: new Date('2026-01-01T00:00:00Z') };
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const auth = new AuthService({ users, sessions, sessionTtlMs: 3_600_000, now: () => clock.now });
  const otps = new InMemoryOtpRepository();
  const service = new OtpService({
    users,
    otps,
    sms: new StubSmsSender(),
    auth,
    now: () => clock.now,
    generateCode: () => '123456',
  });
  return { clock, users, auth, service };
}

describe('OtpService', () => {
  it('requests and verifies a code, creating a customer and a session', async () => {
    const { service, auth } = setup();
    await service.requestOtp(PHONE);
    const { user, token } = await service.verifyOtp(PHONE, '123456');

    expect(user.phone).toBe('+8801712345678');
    expect(user.roles).toContain('customer');
    expect(await auth.validateSession(token)).not.toBeNull();
  });

  it('logs in an existing user instead of creating a new one', async () => {
    const { service, auth } = setup();
    const existing = await auth.createUser({ name: 'R', phone: PHONE, password: 'pw-123456' });
    await service.requestOtp(PHONE);
    const { user } = await service.verifyOtp(PHONE, '123456');
    expect(user.id).toBe(existing.id);
  });

  it('rejects a wrong code', async () => {
    const { service } = setup();
    await service.requestOtp(PHONE);
    await expect(service.verifyOtp(PHONE, '000000')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('locks out after too many attempts', async () => {
    const { service } = setup();
    await service.requestOtp(PHONE);
    for (let i = 0; i < 5; i += 1) {
      await expect(service.verifyOtp(PHONE, '000000')).rejects.toMatchObject({ statusCode: 401 });
    }
    // Even the correct code is now refused.
    await expect(service.verifyOtp(PHONE, '123456')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an expired code', async () => {
    const { service, clock } = setup();
    await service.requestOtp(PHONE);
    clock.now = new Date(clock.now.getTime() + 6 * 60 * 1000);
    await expect(service.verifyOtp(PHONE, '123456')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('rejects an invalid phone on request', async () => {
    const { service } = setup();
    await expect(service.requestOtp('123')).rejects.toMatchObject({ statusCode: 400 });
  });
});
