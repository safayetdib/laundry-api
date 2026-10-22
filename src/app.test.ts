import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { createLogger } from './lib/logger';

const logger = createLogger('silent');

function appWithReadiness(ready: boolean) {
  return createApp({ logger, checkReadiness: () => ready });
}

describe('createApp', () => {
  it('GET /health returns 200 with the success envelope', async () => {
    const res = await request(appWithReadiness(true)).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.meta.requestId).toBe('string');
    expect(res.headers['x-request-id']).toBe(res.body.meta.requestId);
  });

  it('GET /ready returns 200 when dependencies are ready', async () => {
    const res = await request(appWithReadiness(true)).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
  });

  it('GET /ready returns 503 when dependencies are not ready', async () => {
    const res = await request(appWithReadiness(false)).get('/ready');

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('NOT_READY');
  });

  it('serves the OpenAPI document under /api/v1', async () => {
    const res = await request(appWithReadiness(true)).get('/api/v1/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
  });

  it('returns a 404 error envelope for unknown routes', async () => {
    const res = await request(appWithReadiness(true)).get('/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.requestId).toBe('string');
  });

  it('honors a safe incoming x-request-id', async () => {
    const res = await request(appWithReadiness(true))
      .get('/health')
      .set('x-request-id', 'trace-123');

    expect(res.body.meta.requestId).toBe('trace-123');
  });
});
