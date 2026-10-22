import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../lib/errors';
import type { AuthService } from '../modules/auth/auth.service';
import { SESSION_COOKIE } from '../modules/auth/constants';
import type { Role } from '../modules/users/user.types';

/**
 * Populates `req.user` from the session cookie. Denies by default: any
 * missing, invalid, expired or revoked session yields 401; a non-active
 * user yields 403.
 */
export function authenticate(authService: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
      if (!token) throw new UnauthorizedError();

      const result = await authService.validateSession(token);
      if (!result) throw new UnauthorizedError('Invalid or expired session.');
      if (result.user.status !== 'active') throw new ForbiddenError('This account is suspended.');

      req.user = {
        id: result.user.id,
        name: result.user.name,
        phone: result.user.phone,
        roles: result.user.roles,
        status: result.user.status,
        ...(result.user.partnerId ? { partnerId: result.user.partnerId } : {}),
      };
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Requires the authenticated user to hold at least one of the given roles.
 * Must run after authenticate().
 */
export function requireRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.some((role) => req.user!.roles.includes(role))) {
      next(new ForbiddenError('You do not have access to this resource.'));
      return;
    }
    next();
  };
}
