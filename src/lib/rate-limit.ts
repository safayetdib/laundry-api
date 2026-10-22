import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (req: Request) => string;
}

/**
 * Minimal in-memory fixed-window rate limiter. Sufficient for a
 * single-instance pilot (no Redis). Returns 429 with Retry-After once a key
 * exceeds `max` requests within `windowMs`.
 */
export function rateLimit({ windowMs, max, keyFn }: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyFn ? keyFn(req) : (req.ip ?? 'unknown');
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.'));
      return;
    }

    next();
  };
}
