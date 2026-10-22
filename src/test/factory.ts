import { createApp } from '../app';
import { createLogger } from '../lib/logger';
import { AuthService } from '../modules/auth/auth.service';
import { InMemoryUserRepository } from '../modules/users/user.repository';
import { InMemorySessionRepository } from '../modules/auth/session.repository';

export interface TestAppOptions {
  checkReadiness?: () => boolean;
  sessionTtlMs?: number;
}

/**
 * Builds the app with in-memory repositories for integration tests — no
 * database or network required. Returns the app plus its service/repos so
 * tests can seed users and inspect state.
 */
export function buildTestApp(options: TestAppOptions = {}) {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const sessionTtlMs = options.sessionTtlMs ?? 60 * 60 * 1000;
  const authService = new AuthService({ users, sessions, sessionTtlMs });

  const app = createApp({
    logger: createLogger('silent'),
    checkReadiness: options.checkReadiness ?? (() => true),
    authService,
    cookieSecure: false,
    sessionTtlMs,
  });

  return { app, authService, users, sessions };
}
