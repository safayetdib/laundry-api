import { Router, type Request, type Response } from 'express';
import { successEnvelope, errorEnvelope } from '../../lib/http';

export type ReadinessCheck = () => boolean | Promise<boolean>;

/**
 * Liveness (`/health`) and readiness (`/ready`) probes. Readiness reflects
 * downstream dependencies (currently the database) via the injected check.
 */
export function healthRoutes(checkReadiness: ReadinessCheck): Router {
  const router = Router();

  router.get('/health', (req: Request, res: Response) => {
    res.json(
      successEnvelope({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }, req.id),
    );
  });

  router.get('/ready', async (req: Request, res: Response) => {
    const ready = await checkReadiness();
    if (ready) {
      res.json(successEnvelope({ status: 'ready' }, req.id));
      return;
    }
    res.status(503).json(errorEnvelope('NOT_READY', 'Service dependencies are not ready.', req.id));
  });

  return router;
}
