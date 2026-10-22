import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { DeliveryActor, DeliveryService } from './delivery.service';
import { toDeliveryTaskDTO } from './delivery.types';

export interface DeliveryRoutesConfig {
  deliveryService: DeliveryService;
  authService: AuthService;
}

const idParam = z.object({ id: z.string().min(1) });
const countsBody = z.object({
  counts: z
    .array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().nonnegative() }))
    .default([]),
  evidenceKeys: z.array(z.string().min(1)).optional(),
  conditionNotes: z.string().optional(),
  scanAssisted: z.boolean().optional(),
});
const deliverBody = z.object({
  codAmountCollected: z.number().int().nonnegative().optional(),
  evidenceKeys: z.array(z.string().min(1)).optional(),
  conditionNotes: z.string().optional(),
  scanAssisted: z.boolean().optional(),
});

export function deliveryRoutes({ deliveryService, authService }: DeliveryRoutesConfig): Router {
  const router = Router();
  const auth = authenticate(authService);
  const actor = (req: Request): DeliveryActor => ({ id: req.user!.id, roles: req.user!.roles });

  router.post(
    '/admin/orders/:id/pickup-task',
    auth,
    requireRoles('admin', 'operations'),
    requireCsrf,
    validate({ params: idParam, body: z.object({ riderId: z.string().min(1).optional() }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { riderId } = req.validated.body as { riderId?: string };
      const task = await deliveryService.createPickupTask(id, actor(req), riderId);
      res.status(201).json(successEnvelope(toDeliveryTaskDTO(task), req.id));
    }),
  );

  router.post(
    '/admin/orders/:id/delivery-task',
    auth,
    requireRoles('admin', 'operations'),
    requireCsrf,
    validate({
      params: idParam,
      body: z.object({
        scheduledStart: z.string().datetime(),
        scheduledEnd: z.string().datetime(),
        riderId: z.string().min(1).optional(),
      }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as {
        scheduledStart: string;
        scheduledEnd: string;
        riderId?: string;
      };
      const task = await deliveryService.createDeliveryTask(
        id,
        actor(req),
        { scheduledStart: body.scheduledStart, scheduledEnd: body.scheduledEnd },
        body.riderId,
      );
      res.status(201).json(successEnvelope(toDeliveryTaskDTO(task), req.id));
    }),
  );

  router.get(
    '/rider/tasks',
    auth,
    requireRoles('rider'),
    asyncHandler(async (req: Request, res: Response) => {
      const tasks = await deliveryService.listForRider(req.user!.id);
      res.json(successEnvelope(tasks.map(toDeliveryTaskDTO), req.id));
    }),
  );

  router.post(
    '/rider/tasks/:id/complete-pickup',
    auth,
    requireRoles('rider', 'operations', 'admin'),
    requireCsrf,
    validate({ params: idParam, body: countsBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as z.infer<typeof countsBody>;
      const task = await deliveryService.completePickup(id, body, actor(req));
      res.json(successEnvelope(toDeliveryTaskDTO(task), req.id));
    }),
  );

  router.post(
    '/rider/tasks/:id/complete-delivery',
    auth,
    requireRoles('rider', 'operations', 'admin'),
    requireCsrf,
    validate({ params: idParam, body: deliverBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as z.infer<typeof deliverBody>;
      const task = await deliveryService.completeDelivery(id, body, actor(req));
      res.json(successEnvelope(toDeliveryTaskDTO(task), req.id));
    }),
  );

  router.post(
    '/rider/tasks/:id/fail',
    auth,
    requireRoles('rider', 'operations', 'admin'),
    requireCsrf,
    validate({ params: idParam, body: z.object({ reason: z.string().min(1) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { reason } = req.validated.body as { reason: string };
      const task = await deliveryService.failDelivery(id, reason, actor(req));
      res.json(successEnvelope(toDeliveryTaskDTO(task), req.id));
    }),
  );

  return router;
}
