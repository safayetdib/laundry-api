import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { NotFoundError } from '../../lib/errors';
import { successEnvelope } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { generateAvailability } from './zone.availability';
import type { ZoneRepository } from './zone.repository';
import { toZoneDTO } from './zone.types';

const availabilityQuery = z.object({
  zoneId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export function zoneRoutes(zones: ZoneRepository): Router {
  const router = Router();

  router.get(
    '/zones',
    asyncHandler(async (req: Request, res: Response) => {
      const list = await zones.listActive();
      res.json(successEnvelope(list.map(toZoneDTO), req.id));
    }),
  );

  router.get(
    '/zones/availability',
    validate({ query: availabilityQuery }),
    asyncHandler(async (req: Request, res: Response) => {
      const { zoneId, date } = req.validated.query as z.infer<typeof availabilityQuery>;
      const zone = await zones.findById(zoneId);
      if (!zone || !zone.active) throw new NotFoundError('Zone not found.');

      const slots = generateAvailability(zone, new Date(`${date}T00:00:00.000Z`));
      res.json(successEnvelope({ zone: toZoneDTO(zone), date, slots }, req.id));
    }),
  );

  return router;
}
