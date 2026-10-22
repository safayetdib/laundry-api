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
import { InMemoryOrderRepository } from '../modules/orders/order.repository';
import { InMemorySlotRepository } from '../modules/scheduling/slot.repository';
import { SlotService } from '../modules/scheduling/slot.service';
import { InMemoryIdempotencyRepository } from '../modules/idempotency/idempotency.repository';
import { OrderService } from '../modules/orders/order.service';
import { InMemoryPartnerRepository } from '../modules/partners/partner.repository';
import { InMemoryAssignmentRepository } from '../modules/assignments/assignment.repository';
import { AssignmentService } from '../modules/assignments/assignment.service';

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

  const orders = new InMemoryOrderRepository();
  const slotRepo = new InMemorySlotRepository();
  const idempotency = new InMemoryIdempotencyRepository();
  const partners = new InMemoryPartnerRepository();
  const assignments = new InMemoryAssignmentRepository();

  const sessionTtlMs = options.sessionTtlMs ?? 60 * 60 * 1000;
  const authService = new AuthService({ users, sessions, sessionTtlMs });
  const pricingService = new PricingService({ priceLists, services, audit });
  const slotService = new SlotService(slotRepo);
  const orderService = new OrderService({
    orders,
    zones,
    services,
    pricing: pricingService,
    slots: slotService,
    idempotency,
    audit,
  });
  const assignmentService = new AssignmentService({
    assignments,
    orders,
    partners,
    pricing: pricingService,
    audit,
  });

  const app = createApp({
    logger: createLogger('silent'),
    checkReadiness: options.checkReadiness ?? (() => true),
    authService,
    services,
    zones,
    pricingService,
    orderService,
    partners,
    assignmentService,
    cookieSecure: false,
    sessionTtlMs,
  });

  return {
    app,
    authService,
    pricingService,
    orderService,
    slotService,
    assignmentService,
    users,
    sessions,
    services,
    zones,
    priceLists,
    orders,
    slotRepo,
    partners,
    assignments,
    audit,
  };
}
