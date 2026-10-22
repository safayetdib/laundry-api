import { createHash } from 'node:crypto';
import { ConflictError } from '../../lib/errors';
import type { IdempotencyRepository } from './idempotency.repository';

export function hashRequest(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Runs `fn` at most once per (scope, key). Replaying the same key + request
 * returns the stored result; the same key with a different request is a
 * conflict. Without a key, `fn` simply runs.
 */
export async function runIdempotent<T>(
  repo: IdempotencyRepository,
  params: { scope: string; key: string | undefined; requestHash: string },
  fn: () => Promise<T>,
): Promise<T> {
  if (!params.key) {
    return fn();
  }

  const existing = await repo.find(params.scope, params.key);
  if (existing) {
    if (existing.requestHash !== params.requestHash) {
      throw new ConflictError('Idempotency key reused with a different request.');
    }
    return existing.responseData as T;
  }

  const result = await fn();
  await repo.save({
    scope: params.scope,
    key: params.key,
    requestHash: params.requestHash,
    responseData: result,
  });
  return result;
}
