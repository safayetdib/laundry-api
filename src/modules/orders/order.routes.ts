import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { OrderActor, OrderService } from './order.service';
import { toOrderDTO } from './order.types';

export interface OrderRoutesConfig {
  orderService: OrderService;
  authService: AuthService;
}

const addressSchema = z.object({
  contactName: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  area: z.string().min(1),
  city: z.string().min(1),
  note: z.string().optional(),
});

const createOrderBody = z.object({
  addressSnapshot: addressSchema,
  zoneId: z.string().min(1),
  items: z
    .array(
      z.object({
        serviceCode: z.string().min(1),
        garmentCode: z.string().min(1).optional(),
        quantity: z.number().int().positive(),
        conditionNotes: z.string().optional(),
      }),
    )
    .min(1),
  pickupStart: z.string().datetime(),
  deliveryFee: z.number().int().nonnegative().optional(),
  discount: z.number().int().nonnegative().optional(),
  taxBasisPoints: z.number().int().nonnegative().optional(),
});

const approveQuoteBody = z.object({ quoteVersion: z.number().int().positive() });
const idParam = z.object({ id: z.string().min(1) });

export function orderRoutes({ orderService, authService }: OrderRoutesConfig): Router {
  const router = Router();
  const auth = authenticate(authService);
  const actorOf = (req: Request): OrderActor => ({ id: req.user!.id, roles: req.user!.roles });

  router.post(
    '/orders',
    auth,
    requireCsrf,
    validate({ body: createOrderBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.validated.body as z.infer<typeof createOrderBody>;
      const idempotencyKey = req.header('Idempotency-Key');
      const order = await orderService.createOrder(
        {
          addressSnapshot: body.addressSnapshot,
          zoneId: body.zoneId,
          items: body.items,
          pickupStart: body.pickupStart,
          ...(body.deliveryFee !== undefined ? { deliveryFee: body.deliveryFee } : {}),
          ...(body.discount !== undefined ? { discount: body.discount } : {}),
          ...(body.taxBasisPoints !== undefined ? { taxBasisPoints: body.taxBasisPoints } : {}),
        },
        actorOf(req),
        idempotencyKey,
      );
      res.status(201).json(successEnvelope(toOrderDTO(order), req.id));
    }),
  );

  router.get(
    '/customer/orders',
    auth,
    asyncHandler(async (req: Request, res: Response) => {
      const orders = await orderService.listForCustomer(req.user!.id);
      res.json(successEnvelope(orders.map(toOrderDTO), req.id));
    }),
  );

  router.get(
    '/admin/orders',
    auth,
    validate({
      query: z.object({ limit: z.coerce.number().int().positive().max(200).optional() }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { limit } = req.validated.query as { limit?: number };
      const orders = await orderService.listRecent(actorOf(req), limit ?? 50);
      res.json(successEnvelope(orders.map(toOrderDTO), req.id));
    }),
  );

  router.get(
    '/orders/:orderCode',
    auth,
    validate({ params: z.object({ orderCode: z.string().min(1) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { orderCode } = req.validated.params as { orderCode: string };
      const order = await orderService.getByCode(orderCode, actorOf(req));
      res.json(successEnvelope(toOrderDTO(order), req.id));
    }),
  );

  router.post(
    '/orders/:id/approve-quote',
    auth,
    requireCsrf,
    validate({ params: idParam, body: approveQuoteBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { quoteVersion } = req.validated.body as z.infer<typeof approveQuoteBody>;
      const order = await orderService.approveQuote(id, quoteVersion, actorOf(req));
      res.json(successEnvelope(toOrderDTO(order), req.id));
    }),
  );

  router.post(
    '/orders/:id/confirm',
    auth,
    requireCsrf,
    validate({ params: idParam }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const order = await orderService.confirmOrder(id, actorOf(req));
      res.json(successEnvelope(toOrderDTO(order), req.id));
    }),
  );

  router.post(
    '/orders/:id/cancel',
    auth,
    requireCsrf,
    validate({ params: idParam }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const order = await orderService.cancelOrder(id, actorOf(req));
      res.json(successEnvelope(toOrderDTO(order), req.id));
    }),
  );

  router.post(
    '/orders/:id/advance',
    auth,
    requireCsrf,
    validate({
      params: idParam,
      body: z.object({ target: z.enum(['in_service', 'ready_for_delivery']) }),
    }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const { target } = req.validated.body as { target: 'in_service' | 'ready_for_delivery' };
      const order = await orderService.advance(id, target, actorOf(req));
      res.json(successEnvelope(toOrderDTO(order), req.id));
    }),
  );

  return router;
}
