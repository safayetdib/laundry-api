import { randomBytes } from 'node:crypto';
import { Router, type CookieOptions, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler';
import { successEnvelope } from '../../lib/http';
import { rateLimit } from '../../lib/rate-limit';
import { authenticate } from '../../middleware/authenticate';
import { requireCsrf } from '../../middleware/csrf';
import { validate } from '../../middleware/validate';
import { toUserDTO } from '../users/user.types';
import type { AuthService } from './auth.service';
import { CSRF_COOKIE, SESSION_COOKIE } from './constants';

export interface AuthRoutesConfig {
  authService: AuthService;
  cookieSecure: boolean;
  sessionTtlMs: number;
}

const loginSchema = z.object({
  phone: z.string().min(1),
  password: z.string().min(1),
});

export function authRoutes({ authService, cookieSecure, sessionTtlMs }: AuthRoutesConfig): Router {
  const router = Router();

  const sessionCookie: CookieOptions = {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtlMs,
  };
  const csrfCookie: CookieOptions = { ...sessionCookie, httpOnly: false };

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyFn: (req) => req.ip ?? 'unknown',
  });

  router.post(
    '/login',
    loginLimiter,
    validate({ body: loginSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { phone, password } = req.validated.body as z.infer<typeof loginSchema>;
      const { user, token } = await authService.login(phone, password);

      const csrfToken = randomBytes(32).toString('base64url');
      res.cookie(SESSION_COOKIE, token, sessionCookie);
      res.cookie(CSRF_COOKIE, csrfToken, csrfCookie);

      res.json(successEnvelope({ user: toUserDTO(user), csrfToken }, req.id));
    }),
  );

  router.post(
    '/logout',
    authenticate(authService),
    requireCsrf,
    asyncHandler(async (req: Request, res: Response) => {
      const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
      if (token) await authService.logout(token);

      res.clearCookie(SESSION_COOKIE, { path: '/' });
      res.clearCookie(CSRF_COOKIE, { path: '/' });
      res.json(successEnvelope({ status: 'logged_out' }, req.id));
    }),
  );

  router.get('/me', authenticate(authService), (req: Request, res: Response) => {
    res.json(successEnvelope({ user: req.user }, req.id));
  });

  return router;
}
