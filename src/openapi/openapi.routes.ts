import { Router, type Request, type Response } from 'express';
import { openapiDocument } from './openapi';

/** Serves the OpenAPI document (mounted under /api/v1). */
export function openapiRoutes(): Router {
  const router = Router();

  router.get('/openapi.json', (_req: Request, res: Response) => {
    res.json(openapiDocument);
  });

  return router;
}
