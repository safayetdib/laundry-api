import { createApp } from '../app';
import { createLogger } from '../lib/logger';
import { AuthService } from '../modules/auth/auth.service';
import { InMemoryUserRepository } from '../modules/users/user.repository';
import { InMemorySessionRepository } from '../modules/auth/session.repository';
import { InMemoryServiceRepository } from '../modules/catalogue/service.repository';
import { InMemoryZoneRepository } from '../modules/zones/zone.repository';
import { InMemoryPriceListRepository } from '../modules/pricing/pricelist.repository';
import { InMemoryAuditRepository } from '../modules/audit/audit.repository';
import { PricingService } from '../modules/pricing/pricing.service';

export interface TestAppOptions {
  checkReadiness?: () => boolean;
  sessionTtlMs?: number;
}

/**
 * Builds the app with in-memory repositories for integration tests — no
 * database or network required. Returns the app plus its services/repos so
 * tests can seed data and inspect state.
 */
export function buildTestApp(options: TestAppOptions = {}) {
  const users = new InMemoryUserRepository();
  const sessions = new InMemorySessionRepository();
  const services = new InMemoryServiceRepository();
  const zones = new InMemoryZoneRepository();
  const priceLists = new InMemoryPriceListRepository();
  const audit = new InMemoryAuditRepository();

  const sessionTtlMs = options.sessionTtlMs ?? 60 * 60 * 1000;
  const authService = new AuthService({ users, sessions, sessionTtlMs });
  const pricingService = new PricingService({ priceLists, services, audit });

  const app = createApp({
    logger: createLogger('silent'),
    checkReadiness: options.checkReadiness ?? (() => true),
    authService,
    services,
    zones,
    pricingService,
    cookieSecure: false,
    sessionTtlMs,
  });

  return { app, authService, pricingService, users, sessions, services, zones, priceLists, audit };
}
