import type { Request, Response } from 'express';
import { errorEnvelope } from '../lib/http';

/** Terminal 404 handler for unmatched routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorEnvelope('NOT_FOUND', 'Resource not found.', req.id));
}
