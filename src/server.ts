import { createApp } from './app';
import { loadEnv } from './config/env';
import { createLogger } from './lib/logger';
import { connectDb, disconnectDb, dbReadiness } from './lib/db';
import { MongoUserRepository } from './modules/users/user.model';
import { MongoSessionRepository } from './modules/auth/session.model';
import { AuthService } from './modules/auth/auth.service';
import { MongoServiceRepository } from './modules/catalogue/service.model';
import { MongoZoneRepository } from './modules/zones/zone.model';
import { MongoPriceListRepository } from './modules/pricing/pricelist.model';
import { MongoAuditRepository } from './modules/audit/audit.model';
import { PricingService } from './modules/pricing/pricing.service';
import { MongoOrderRepository } from './modules/orders/order.model';
import { MongoSlotRepository } from './modules/scheduling/slot.model';
import { SlotService } from './modules/scheduling/slot.service';
import { MongoIdempotencyRepository } from './modules/idempotency/idempotency.model';
import { OrderService } from './modules/orders/order.service';
import { MongoPartnerRepository } from './modules/partners/partner.model';
import { MongoAssignmentRepository } from './modules/assignments/assignment.model';
import { AssignmentService } from './modules/assignments/assignment.service';
import { MongoHandoverRepository } from './modules/handovers/handover.model';
import { HandoverService } from './modules/handovers/handover.service';
import { ProcessingService } from './modules/processing/processing.service';
import { createEvidenceStorage } from './modules/evidence/evidence.storage';
import { MongoPaymentRepository } from './modules/payments/payment.model';
import { PaymentService } from './modules/payments/payment.service';
import { MongoDeliveryTaskRepository } from './modules/delivery/delivery.model';
import { DeliveryService } from './modules/delivery/delivery.service';
import { MongoQualityCaseRepository } from './modules/quality/quality.model';
import { QualityService } from './modules/quality/quality.service';
import { MongoManifestRepository } from './modules/routing/manifest.model';
import { ManifestService } from './modules/routing/manifest.service';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);

  try {
    await connectDb(env.MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to MongoDB');
    process.exit(1);
  }

  const sessionTtlMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const services = new MongoServiceRepository();
  const authService = new AuthService({
    users: new MongoUserRepository(),
    sessions: new MongoSessionRepository(),
    sessionTtlMs,
  });
  const audit = new MongoAuditRepository();
  const zones = new MongoZoneRepository();
  const pricingService = new PricingService({
    priceLists: new MongoPriceListRepository(),
    services,
    audit,
  });
  const orders = new MongoOrderRepository();
  const partners = new MongoPartnerRepository();
  const idempotency = new MongoIdempotencyRepository();
  const orderService = new OrderService({
    orders,
    zones,
    services,
    pricing: pricingService,
    slots: new SlotService(new MongoSlotRepository()),
    idempotency,
    audit,
  });
  const assignments = new MongoAssignmentRepository();
  const assignmentService = new AssignmentService({
    assignments,
    orders,
    partners,
    pricing: pricingService,
    audit,
  });
  const handoverService = new HandoverService({ handovers: new MongoHandoverRepository(), audit });
  const processingService = new ProcessingService({ assignments, handovers: handoverService });
  const evidenceStorage = createEvidenceStorage(env);
  const paymentService = new PaymentService({
    payments: new MongoPaymentRepository(),
    audit,
    idempotency,
  });
  const deliveryService = new DeliveryService({
    tasks: new MongoDeliveryTaskRepository(),
    orders,
    handovers: handoverService,
    payments: paymentService,
    audit,
  });
  const qualityService = new QualityService({
    cases: new MongoQualityCaseRepository(),
    orders,
    audit,
  });
  const manifestService = new ManifestService({ manifests: new MongoManifestRepository(), audit });

  const app = createApp({
    logger,
    checkReadiness: dbReadiness,
    authService,
    services,
    zones,
    pricingService,
    orderService,
    partners,
    assignmentService,
    processingService,
    handoverService,
    evidenceStorage,
    deliveryService,
    paymentService,
    qualityService,
    manifestService,
    cookieSecure: env.COOKIE_SECURE_RESOLVED,
    sessionTtlMs,
  });
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'laundry-api listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDb().finally(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      });
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // Logger may not exist yet if config failed; use console as a last resort.
  console.error(err);
  process.exit(1);
});
