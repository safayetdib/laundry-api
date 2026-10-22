import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../lib/errors';
import { CSRF_COOKIE, CSRF_HEADER } from '../modules/auth/constants';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection for cookie-authenticated, state-changing
 * requests: the `x-csrf-token` header must match the readable CSRF cookie.
 * Safe (read-only) methods are exempt.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
  const headerToken = req.header(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    next(new ForbiddenError('Invalid or missing CSRF token.'));
    return;
  }

  next();
}
