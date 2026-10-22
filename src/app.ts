import express, { type Express, type Request, type Response } from 'express';

/**
 * Creates the Express application.
 *
 * Milestone 0 keeps this intentionally minimal (no product modules). The
 * `/health` route is a placeholder liveness check; Milestone 1 replaces it
 * with validated config, structured logging, request IDs, centralized error
 * handling and proper health/readiness checks (including database
 * connectivity).
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  return app;
}
