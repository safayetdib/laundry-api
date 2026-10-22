import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ValidationError } from '../lib/errors';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates request parts with Zod. Validated values are stored on
 * `req.validated` (not reassigned onto `req.query`/`req.params`, which are
 * not safely writable) so handlers read typed, sanitized input.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.validated.params = schemas.params.parse(req.params);
      if (schemas.query) req.validated.query = schemas.query.parse(req.query);
      if (schemas.body) req.validated.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        next(new ValidationError('Invalid request input.', details));
        return;
      }
      next(err);
    }
  };
}
