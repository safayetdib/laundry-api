import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const MAX_INCOMING_ID_LENGTH = 128;
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

/**
 * Assigns a correlation id to every request. A client-supplied
 * `x-request-id` is honored only if it is short and safe; otherwise a fresh
 * UUID is generated. The id is echoed in the response header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  const id =
    incoming && incoming.length <= MAX_INCOMING_ID_LENGTH && SAFE_ID.test(incoming)
      ? incoming
      : randomUUID();

  req.id = id;
  req.validated = {};
  res.setHeader('x-request-id', id);
  next();
}
