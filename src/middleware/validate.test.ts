import { describe, it, expect } from 'vitest';
import express, { type Request, type Response } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { requestId } from './request-id';
import { validate } from './validate';
import { errorHandler } from './error-handler';
import { createLogger } from '../lib/logger';

const logger = createLogger('silent');

function buildApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());

  app.post(
    '/items',
    validate({
      body: z.object({ name: z.string().min(1), quantity: z.number().int().positive() }),
    }),
    (req: Request, res: Response) => {
      res.status(201).json({ received: req.validated.body });
    },
  );

  app.use(errorHandler(logger));
  return app;
}

describe('validate', () => {
  it('passes valid input through to the handler', async () => {
    const res = await request(buildApp()).post('/items').send({ name: 'Shirt', quantity: 2 });

    expect(res.status).toBe(201);
    expect(res.body.received).toEqual({ name: 'Shirt', quantity: 2 });
  });

  it('rejects invalid input with a 400 VALIDATION_ERROR and details', async () => {
    const res = await request(buildApp()).post('/items').send({ name: '', quantity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});
