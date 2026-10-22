import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { ConflictError } from '../../lib/errors';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import { PARTNER_STATUSES } from './partner.types';
import { toPartnerDTO } from './partner.types';
import type { PartnerRepository } from './partner.repository';

export interface PartnerRoutesConfig {
  partners: PartnerRepository;
  authService: AuthService;
}

const createPartnerBody = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(PARTNER_STATUSES).optional(),
  serviceCodes: z.array(z.string().min(1)).optional(),
  zoneIds: z.array(z.string().min(1)).optional(),
  contact: z.object({ phone: z.string().optional(), email: z.string().optional() }).optional(),
});

export function partnerRoutes({ partners, authService }: PartnerRoutesConfig): Router {
  const router = Router();
  const staff = [authenticate(authService), requireRoles('admin', 'operations')];

  router.get(
    '/admin/partners',
    ...staff,
    asyncHandler(async (req: Request, res: Response) => {
      const list = await partners.listAll();
      res.json(successEnvelope(list.map(toPartnerDTO), req.id));
    }),
  );

  router.post(
    '/admin/partners',
    ...staff,
    requireCsrf,
    validate({ body: createPartnerBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.validated.body as z.infer<typeof createPartnerBody>;
      try {
        const partner = await partners.create(body);
        res.status(201).json(successEnvelope(toPartnerDTO(partner), req.id));
      } catch (err) {
        if (err instanceof Error && err.message === 'DUPLICATE_CODE') {
          throw new ConflictError('A partner with this code already exists.');
        }
        throw err;
      }
    }),
  );

  return router;
}
