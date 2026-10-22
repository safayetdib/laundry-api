import express, { type Express, Router } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { notFoundHandler } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';
import { healthRoutes, type ReadinessCheck } from './modules/health/health.routes';
import { openapiRoutes } from './openapi/openapi.routes';
import { authRoutes } from './modules/auth/auth.routes';
import type { AuthService } from './modules/auth/auth.service';
import { serviceRoutes } from './modules/catalogue/service.routes';
import type { ServiceRepository } from './modules/catalogue/service.repository';
import { zoneRoutes } from './modules/zones/zone.routes';
import type { ZoneRepository } from './modules/zones/zone.repository';
import { pricingRoutes } from './modules/pricing/pricing.routes';
import type { PricingService } from './modules/pricing/pricing.service';
import { orderRoutes } from './modules/orders/order.routes';
import type { OrderService } from './modules/orders/order.service';
import { partnerRoutes } from './modules/partners/partner.routes';
import type { PartnerRepository } from './modules/partners/partner.repository';
import { assignmentRoutes } from './modules/assignments/assignment.routes';
import type { AssignmentService } from './modules/assignments/assignment.service';
import { processingRoutes } from './modules/processing/processing.routes';
import type { ProcessingService } from './modules/processing/processing.service';
import type { HandoverService } from './modules/handovers/handover.service';
import { evidenceRoutes } from './modules/evidence/evidence.routes';
import type { EvidenceStorage } from './modules/evidence/evidence.storage';
import type { Logger } from './lib/logger';

export interface AppOptions {
  logger: Logger;
  checkReadiness: ReadinessCheck;
  authService: AuthService;
  services: ServiceRepository;
  zones: ZoneRepository;
  pricingService: PricingService;
  orderService: OrderService;
  partners: PartnerRepository;
  assignmentService: AssignmentService;
  processingService: ProcessingService;
  handoverService: HandoverService;
  evidenceStorage: EvidenceStorage;
  cookieSecure: boolean;
  sessionTtlMs: number;
}

/**
 * Builds the Express application. All dependencies are injected so the app
 * is testable without a database or network.
 *
 * Product modules are mounted on the `/api/v1` router as later milestones
 * add them; business rules live in services, not here.
 */
export function createApp({
  logger,
  checkReadiness,
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
  cookieSecure,
  sessionTtlMs,
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  // Trust the proxy so req.ip reflects the client behind managed hosting.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(express.json());
  app.use(cookieParser());

  // Operational probes at the root.
  app.use('/', healthRoutes(checkReadiness));

  // Versioned API surface.
  const apiV1 = Router();
  apiV1.use(openapiRoutes());
  apiV1.use('/auth', authRoutes({ authService, cookieSecure, sessionTtlMs }));
  apiV1.use(serviceRoutes(services));
  apiV1.use(zoneRoutes(zones));
  apiV1.use(pricingRoutes({ pricingService, services, authService }));
  apiV1.use(orderRoutes({ orderService, authService }));
  apiV1.use(partnerRoutes({ partners, authService }));
  apiV1.use(assignmentRoutes({ assignmentService, authService }));
  apiV1.use(processingRoutes({ processingService, handoverService, orderService, authService }));
  apiV1.use(evidenceRoutes({ storage: evidenceStorage, authService }));
  app.use('/api/v1', apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
