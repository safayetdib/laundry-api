import { describe, it, expect } from 'vitest';
import { successEnvelope, errorEnvelope } from './http';

describe('successEnvelope', () => {
  it('wraps data with requestId in meta', () => {
    expect(successEnvelope({ a: 1 }, 'req-1')).toEqual({
      data: { a: 1 },
      meta: { requestId: 'req-1' },
    });
  });

  it('merges extra meta', () => {
    expect(successEnvelope([], 'req-2', { total: 0 })).toEqual({
      data: [],
      meta: { requestId: 'req-2', total: 0 },
    });
  });
});

describe('errorEnvelope', () => {
  it('shapes the error with a null details default', () => {
    expect(errorEnvelope('NOT_FOUND', 'Missing.', 'req-3')).toEqual({
      error: { code: 'NOT_FOUND', message: 'Missing.', details: null, requestId: 'req-3' },
    });
  });
});
