import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import { ROUTE_STOP_TYPES, toManifestDTO } from './manifest.types';
import type { ManifestActor, ManifestService } from './manifest.service';

export interface ManifestRoutesConfig {
  manifestService: ManifestService;
  authService: AuthService;
}

const idParam = z.object({ id: z.string().min(1) });

export function manifestRoutes({ manifestService, authService }: ManifestRoutesConfig): Router {
  const router = Router();
  const auth = authenticate(authService);
  const staff = [auth, requireRoles('admin', 'operations'), requireCsrf];
  const actor = (req: Request): ManifestActor => ({ id: req.user!.id, roles: req.user!.roles });

  router.post(
    '/admin/route-manifests',
    ...staff,
    validate({
      body: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        notes: z.string().optional(),
        vehicleCapacity: z.number().int().positive().optional(),
      }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.validated.body as { date: string; notes?: string; vehicleCapacity?: number };
      const manifest = await manifestService.createManifest(body, actor(req));
      res.status(201).json(successEnvelope(toManifestDTO(manifest), req.id));
    }),
  );

  router.post(
    '/admin/route-manifests/:id/stops',
    ...staff,
    validate({
      params: idParam,
      body: z.object({
        stops: z
          .array(
            z.object({
              type: z.enum(ROUTE_STOP_TYPES),
              orderId: z.string().min(1).optional(),
              deliveryTaskId: z.string().min(1).optional(),
            }),
          )
          .min(1),
      }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { stops } = req.validated.body as {
        stops: {
          type: (typeof ROUTE_STOP_TYPES)[number];
          orderId?: string;
          deliveryTaskId?: string;
        }[];
      };
      const manifest = await manifestService.setStops(id, stops, actor(req));
      res.json(successEnvelope(toManifestDTO(manifest), req.id));
    }),
  );

  router.post(
    '/admin/route-manifests/:id/assign',
    ...staff,
    validate({ params: idParam, body: z.object({ riderId: z.string().min(1) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { riderId } = req.validated.body as { riderId: string };
      const manifest = await manifestService.assignRider(id, riderId, actor(req));
      res.json(successEnvelope(toManifestDTO(manifest), req.id));
    }),
  );

  router.get(
    '/rider/manifests',
    auth,
    requireRoles('rider'),
    asyncHandler(async (req: Request, res: Response) => {
      const manifests = await manifestService.listForRider(req.user!.id);
      res.json(successEnvelope(manifests.map(toManifestDTO), req.id));
    }),
  );

  return router;
}
