import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import type { ServiceRepository } from './service.repository';
import { toServiceDTO } from './service.types';

/** Public catalogue listing: GET /services. */
export function serviceRoutes(services: ServiceRepository): Router {
  const router = Router();

  router.get(
    '/services',
    asyncHandler(async (req: Request, res: Response) => {
      const list = await services.listActive();
      res.json(successEnvelope(list.map(toServiceDTO), req.id));
    }),
  );

  return router;
}
