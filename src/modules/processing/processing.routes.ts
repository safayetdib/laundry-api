import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { AssignmentActor } from '../assignments/assignment.service';
import { toAssignmentDTO } from '../assignments/assignment.types';
import type { HandoverService } from '../handovers/handover.service';
import { toHandoverDTO } from '../handovers/handover.types';
import type { OrderService } from '../orders/order.service';
import type { ProcessingService } from './processing.service';

export interface ProcessingRoutesConfig {
  processingService: ProcessingService;
  handoverService: HandoverService;
  orderService: OrderService;
  authService: AuthService;
}

const intakeBody = z.object({
  receivedItems: z
    .array(z.object({ orderItemId: z.string().min(1), quantity: z.number().int().nonnegative() }))
    .min(1),
  conditionNotes: z.string().optional(),
  evidenceKeys: z.array(z.string().min(1)).optional(),
  scanAssisted: z.boolean().optional(),
});

export function processingRoutes({
  processingService,
  handoverService,
  orderService,
  authService,
}: ProcessingRoutesConfig): Router {
  const router = Router();
  const auth = authenticate(authService);
  const partnerActor = (req: Request): AssignmentActor => ({
    id: req.user!.id,
    roles: req.user!.roles,
    ...(req.user!.partnerId ? { partnerId: req.user!.partnerId } : {}),
  });

  router.post(
    '/partner/assignments/:id/intake',
    auth,
    requireRoles('partner_staff'),
    requireCsrf,
    validate({ params: z.object({ id: z.string().min(1) }), body: intakeBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as z.infer<typeof intakeBody>;
      const assignment = await processingService.recordIntake(
        id,
        {
          receivedItems: body.receivedItems,
          ...(body.conditionNotes ? { conditionNotes: body.conditionNotes } : {}),
          ...(body.evidenceKeys ? { evidenceKeys: body.evidenceKeys } : {}),
          ...(body.scanAssisted !== undefined ? { scanAssisted: body.scanAssisted } : {}),
        },
        partnerActor(req),
        req.id,
      );
      res.json(successEnvelope(toAssignmentDTO(assignment), req.id));
    }),
  );

  // Append-only handover history for an order (authorized via order access).
  router.get(
    '/orders/:orderCode/handovers',
    auth,
    validate({ params: z.object({ orderCode: z.string().min(1) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderCode } = req.validated.params as { orderCode: string };
      const order = await orderService.getByCode(orderCode, {
        id: req.user!.id,
        roles: req.user!.roles,
      });
      const events = await handoverService.listForOrder(order.id);
      res.json(successEnvelope(events.map(toHandoverDTO), req.id));
    }),
  );

  return router;
}
