import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { authenticate, requireRoles } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import type { AuthService } from '../auth/auth.service';
import type { EvidenceStorage } from './evidence.storage';

export interface EvidenceRoutesConfig {
  storage: EvidenceStorage;
  authService: AuthService;
}

const uploadBody = z.object({ contentType: z.string().min(1) });

/** Issues a private upload target for evidence photos (riders/partner staff). */
export function evidenceRoutes({ storage, authService }: EvidenceRoutesConfig): Router {
  const router = Router();

  router.post(
    '/uploads/evidence',
    authenticate(authService),
    requireRoles('rider', 'partner_staff', 'operations', 'admin'),
    requireCsrf,
    validate({ body: uploadBody }),
    asyncHandler(async (req: Request, res: Response) => {
      const { contentType } = req.validated.body as z.infer<typeof uploadBody>;
      const target = await storage.createUploadTarget(contentType);
      res.status(201).json(successEnvelope(target, req.id));
    }),
  );

  return router;
}
