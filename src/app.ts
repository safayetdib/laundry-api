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
import type { Logger } from './lib/logger';

export interface AppOptions {
  logger: Logger;
  checkReadiness: ReadinessCheck;
  authService: AuthService;
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
  app.use('/api/v1', apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return app;
}
