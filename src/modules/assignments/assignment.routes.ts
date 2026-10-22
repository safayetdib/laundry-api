import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import { ASSIGNMENT_STATUSES } from './assignment.status';
import type { AssignmentActor, AssignmentService } from './assignment.service';
import { toAssignmentDTO } from './assignment.types';

export interface AssignmentRoutesConfig {
  assignmentService: AssignmentService;
  authService: AuthService;
}

const assignBody = z.object({
  partnerId: z.string().min(1),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        serviceCode: z.string().min(1),
        garmentCode: z.string().min(1).optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

const statusBody = z.object({ status: z.enum(ASSIGNMENT_STATUSES) });
const idParam = z.object({ id: z.string().min(1) });

export function assignmentRoutes({
  assignmentService,
  authService,
}: AssignmentRoutesConfig): Router {
  const router = Router();
  const auth = authenticate(authService);
  const partnerActor = (req: Request): AssignmentActor => ({
    id: req.user!.id,
    roles: req.user!.roles,
    ...(req.user!.partnerId ? { partnerId: req.user!.partnerId } : {}),
  });

  router.post(
    '/admin/orders/:id/assignments',
    auth,
    requireRoles('admin', 'operations'),
    requireCsrf,
    validate({ params: idParam, body: assignBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as z.infer<typeof assignBody>;
      const assignment = await assignmentService.createAssignment(id, body.partnerId, body.items, {
        id: req.user!.id,
        roles: req.user!.roles,
      });
      res.status(201).json(successEnvelope(toAssignmentDTO(assignment), req.id));
    }),
  );

  router.get(
    '/partner/assignments',
    auth,
    requireRoles('partner_staff'),
    asyncHandler(async (req: Request, res: Response) => {
      const list = await assignmentService.listForPartner(req.user!.partnerId ?? '');
      res.json(successEnvelope(list.map(toAssignmentDTO), req.id));
    }),
  );

  router.post(
    '/partner/assignments/:id/accept',
    auth,
    requireRoles('partner_staff'),
    requireCsrf,
    validate({ params: idParam }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const assignment = await assignmentService.updateStatus(id, 'accepted', partnerActor(req));
      res.json(successEnvelope(toAssignmentDTO(assignment), req.id));
    }),
  );

  router.post(
    '/partner/assignments/:id/status',
    auth,
    requireRoles('partner_staff'),
    requireCsrf,
    validate({ params: idParam, body: statusBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { status } = req.validated.body as z.infer<typeof statusBody>;
      const assignment = await assignmentService.updateStatus(id, status, partnerActor(req));
      res.json(successEnvelope(toAssignmentDTO(assignment), req.id));
    }),
  );

  return router;
}
