import { describe, it, expect } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';
import { requestId } from './request-id';
import { requireRoles } from './authenticate';
import { errorHandler } from './error-handler';
import { createLogger } from '../lib/logger';
import type { Role } from '../modules/users/user.types';

function appWithUserRoles(roles: Role[]) {
  const app = express();
  app.use(requestId);
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { id: '1', name: 'x', phone: '+8801712345678', roles, status: 'active' };
    next();
  });
  app.get('/admin', requireRoles('admin', 'operations'), (_req: Request, res: Response) => {
    res.json({ ok: true });
  });
  app.use(errorHandler(createLogger('silent')));
  return app;
}

describe('requireRoles', () => {
  it('allows a user holding one of the required roles', async () => {
    const res = await request(appWithUserRoles(['operations'])).get('/admin');
    expect(res.status).toBe(200);
  });

  it('forbids a user without any required role', async () => {
    const res = await request(appWithUserRoles(['customer'])).get('/admin');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
