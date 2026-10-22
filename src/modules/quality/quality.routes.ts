import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { OrderService } from '../orders/order.service';
import { QUALITY_STATUSES, QUALITY_TYPES, toQualityCaseDTO } from './quality.types';
import type { QualityActor, QualityService } from './quality.service';

export interface QualityRoutesConfig {
  qualityService: QualityService;
  orderService: OrderService;
  authService: AuthService;
}

export function qualityRoutes({
  qualityService,
  orderService,
  authService,
}: QualityRoutesConfig): Router {
  const router = Router();
  const auth = authenticate(authService);
  const actor = (req: Request): QualityActor => ({ id: req.user!.id, roles: req.user!.roles });

  router.post(
    '/quality-cases',
    auth,
    requireCsrf,
    validate({
      body: z.object({
        orderId: z.string().min(1),
        type: z.enum(QUALITY_TYPES),
        description: z.string().min(1),
        evidenceKeys: z.array(z.string().min(1)).optional(),
      }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.validated.body as {
        orderId: string;
        type: (typeof QUALITY_TYPES)[number];
        description: string;
        evidenceKeys?: string[];
      };
      const created = await qualityService.createCase(body, actor(req));
      res.status(201).json(successEnvelope(toQualityCaseDTO(created), req.id));
    }),
  );

  router.post(
    '/quality-cases/:id',
    auth,
    requireRoles('admin', 'operations', 'support'),
    requireCsrf,
    validate({
      params: z.object({ id: z.string().min(1) }),
      body: z.object({
        status: z.enum(QUALITY_STATUSES).optional(),
        resolution: z.string().min(1).optional(),
      }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as {
        status?: (typeof QUALITY_STATUSES)[number];
        resolution?: string;
      };
      const updated = await qualityService.updateCase(id, body, actor(req));
      res.json(successEnvelope(toQualityCaseDTO(updated), req.id));
    }),
  );

  router.get(
    '/orders/:orderCode/quality-cases',
    auth,
    validate({ params: z.object({ orderCode: z.string().min(1) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderCode } = req.validated.params as { orderCode: string };
      const order = await orderService.getByCode(orderCode, actor(req));
      const cases = await qualityService.listForOrder(order.id);
      res.json(successEnvelope(cases.map(toQualityCaseDTO), req.id));
    }),
  );

  return router;
}
