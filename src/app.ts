import express, { type Express, Router } from 'express';
import { requestId } from './middleware/request-id';
import { requestLogger } from './middleware/request-logger';
import { notFoundHandler } from './middleware/not-found';
import { errorHandler } from './middleware/error-handler';
import { healthRoutes, type ReadinessCheck } from './modules/health/health.routes';
import { openapiRoutes } from './openapi/openapi.routes';
import type { Logger } from './lib/logger';

export interface AppOptions {
  logger: Logger;
  checkReadiness: ReadinessCheck;
}

/**
 * Builds the Express application. All dependencies are injected so the app
 * is testable without a database or network (readiness is a function).
 *
 * Product modules are mounted on the `/api/v1` router as later milestones
 * add them; business rules live in services, not here.
 */
export function createApp({ logger, checkReadiness }: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLogger(logger));
  app.use(express.json());

  // Operational probes at the root.
  app.use('/', healthRoutes(checkReadiness));

  // Versioned API surface.
  const apiV1 = Router();
  apiV1.use(openapiRoutes());
  app.use('/api/v1', apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
