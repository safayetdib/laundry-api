import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestId } from './request-id';
import { errorHandler } from './error-handler';
import { NotFoundError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const logger = createLogger('silent');

function buildApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());

  app.get('/app-error', () => {
    throw new NotFoundError('Nope.');
  });
  app.get('/boom', () => {
    throw new Error('internal detail that must not leak');
  });
  app.post('/echo', (req, res) => {
    res.json({ ok: true, body: req.body });
  });

  app.use(errorHandler(logger));
  return app;
}

describe('errorHandler', () => {
  it('maps an AppError to its status and envelope', async () => {
    const res = await request(buildApp()).get('/app-error');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Nope.' });
  });

  it('returns 500 for unexpected errors without leaking the message', async () => {
    const res = await request(buildApp()).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('internal detail');
    expect(JSON.stringify(res.body)).not.toContain('stack');
  });

  it('maps malformed JSON bodies to a 400 envelope', async () => {
    const res = await request(buildApp())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{ not valid json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
