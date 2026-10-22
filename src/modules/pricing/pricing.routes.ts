import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { AppError } from '../../lib/errors';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { ServiceRepository } from '../catalogue/service.repository';
import { PRICE_LIST_KINDS } from './pricelist.types';
import { toPriceListDTO } from './pricelist.types';
import type { PricingService } from './pricing.service';

export interface PricingRoutesConfig {
  pricingService: PricingService;
  services: ServiceRepository;
  authService: AuthService;
}

const pricingQuery = z.object({ zoneId: z.string().min(1).optional() });

const entrySchema = z.object({
  serviceCode: z.string().min(1),
  garmentCode: z.string().min(1).optional(),
  unitAmount: z.number().int().nonnegative(),
});

const createPriceListBody = z.object({
  kind: z.enum(PRICE_LIST_KINDS),
  name: z.string().min(1),
  partnerId: z.string().min(1).optional(),
  zoneId: z.string().min(1).optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  entries: z.array(entrySchema).min(1),
});

export function pricingRoutes({
  pricingService,
  services,
  authService,
}: PricingRoutesConfig): Router {
  const router = Router();
  const adminOnly = [authenticate(authService), requireRoles('admin', 'operations'), requireCsrf];

  // Public customer price preview for a zone.
  router.get(
    '/pricing',
    validate({ query: pricingQuery }),
    asyncHandler(async (req: Request, res: Response) => {
      const { zoneId } = req.validated.query as z.infer<typeof pricingQuery>;
      const active = await services.listActive();
      const now = new Date();

      const priced = [];
      for (const service of active) {
        try {
          const price = await pricingService.selectPrice({
            kind: 'customer',
            serviceCode: service.code,
            ...(zoneId ? { zoneId } : {}),
            at: now,
          });
          priced.push({
            serviceCode: service.code,
            name: service.name,
            pricingUnit: service.pricingUnit,
            unitAmount: price.unitAmount,
            currency: price.currency,
          });
        } catch (err) {
          // Skip services with no single applicable price in this preview.
          if (err instanceof AppError && err.statusCode === 422) continue;
          throw err;
        }
      }

      res.json(successEnvelope({ zoneId: zoneId ?? null, services: priced }, req.id));
    }),
  );

  router.post(
    '/admin/price-lists',
    ...adminOnly,
    validate({ body: createPriceListBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.validated.body as z.infer<typeof createPriceListBody>;
      const list = await pricingService.createPriceList(
        {
          kind: body.kind,
          name: body.name,
          ...(body.partnerId ? { partnerId: body.partnerId } : {}),
          ...(body.zoneId ? { zoneId: body.zoneId } : {}),
          effectiveFrom: new Date(body.effectiveFrom),
          ...(body.effectiveTo ? { effectiveTo: new Date(body.effectiveTo) } : {}),
          entries: body.entries,
        },
        req.user!.id,
        req.id,
      );
      res.status(201).json(successEnvelope(toPriceListDTO(list), req.id));
    }),
  );

  router.post(
    '/admin/price-lists/:id/publish',
    ...adminOnly,
    validate({ params: z.object({ id: z.string().min(1) }) }),
    asyncHandler(async (req: Request, res: Response) => {
      const { id } = req.validated.params as { id: string };
      const list = await pricingService.publishPriceList(id, req.user!.id, req.id);
      res.json(successEnvelope(toPriceListDTO(list), req.id));
    }),
  );

  return router;
}
