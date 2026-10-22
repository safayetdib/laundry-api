import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { OrderService } from '../orders/order.service';
import type { PaymentActor, PaymentService } from './payment.service';
import { toPaymentEntryDTO } from './payment.types';

export interface PaymentRoutesConfig {
  paymentService: PaymentService;
  orderService: OrderService;
  authService: AuthService;
}

const idParam = z.object({ id: z.string().min(1) });

export function paymentRoutes({
  paymentService,
  orderService,
  authService,
}: PaymentRoutesConfig): Router {
  const router = Router();
  const auth = authenticate(authService);
  const actor = (req: Request): PaymentActor => ({ id: req.user!.id, roles: req.user!.roles });

  router.post(
    '/orders/:id/payments',
    auth,
    requireCsrf,
    validate({
      params: idParam,
      body: z.object({
        method: z.enum(['bkash', 'nagad']),
        amount: z.number().int().positive(),
        reference: z.string().min(1).optional(),
      }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as {
        method: 'bkash' | 'nagad';
        amount: number;
        reference?: string;
      };
      const entry = await paymentService.recordManualPayment(
        id,
        body.method,
        body.amount,
        actor(req),
        body.reference,
      );
      res.status(201).json(successEnvelope(toPaymentEntryDTO(entry), req.id));
    }),
  );

  router.post(
    '/payments/:id/verify',
    auth,
    requireRoles('admin', 'operations'),
    requireCsrf,
    validate({ params: idParam, body: z.object({ decision: z.enum(['verified', 'rejected']) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { decision } = req.validated.body as { decision: 'verified' | 'rejected' };
      const entry = await paymentService.verifyPayment(id, decision, actor(req));
      res.json(successEnvelope(toPaymentEntryDTO(entry), req.id));
    }),
  );

  router.post(
    '/orders/:id/refunds',
    auth,
    requireRoles('admin', 'operations'),
    requireCsrf,
    validate({
      params: idParam,
      body: z.object({
        method: z.enum(['cod', 'bkash', 'nagad']),
        amount: z.number().int().positive(),
        reference: z.string().min(1).optional(),
      }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const body = req.validated.body as {
        method: 'cod' | 'bkash' | 'nagad';
        amount: number;
        reference?: string;
      };
      const entry = await paymentService.recordRefund(
        id,
        body.method,
        body.amount,
        actor(req),
        body.reference,
      );
      res.status(201).json(successEnvelope(toPaymentEntryDTO(entry), req.id));
    }),
  );

  router.get(
    '/orders/:orderCode/payments',
    auth,
    validate({ params: z.object({ orderCode: z.string().min(1) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderCode } = req.validated.params as { orderCode: string };
      const order = await orderService.getByCode(orderCode, {
        id: req.user!.id,
        roles: req.user!.roles,
      });
      const [entries, balance] = await Promise.all([
        paymentService.listForOrder(order.id),
        paymentService.getBalance(order.id, order.quote.total),
      ]);
      res.json(successEnvelope({ entries: entries.map(toPaymentEntryDTO), balance }, req.id));
    }),
  );

  return router;
}
