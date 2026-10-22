import type { NextFunction, Request, Response } from 'express';
import { AppError, readErrorStatus } from '../lib/errors';
import { errorEnvelope } from '../lib/http';
import type { Logger } from '../lib/logger';

/**
 * Central error handler. Translates errors into the error envelope without
 * ever leaking stack traces, internal messages or query details to clients.
 */
export function errorHandler(logger: Logger) {
  return (err: unknown, req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        logger.error({ requestId: req.id, code: err.code, err }, err.message);
      } else {
        logger.warn({ requestId: req.id, code: err.code }, err.message);
      }
      res.status(err.statusCode).json(errorEnvelope(err.code, err.message, req.id, err.details));
      return;
    }

    // Client errors raised by framework middleware (e.g. malformed JSON body).
    const status = readErrorStatus(err);
    if (typeof status === 'number' && status >= 400 && status < 500) {
      logger.warn({ requestId: req.id, status }, 'Client request error');
      res.status(status).json(errorEnvelope('BAD_REQUEST', 'Malformed request.', req.id));
      return;
    }

    logger.error({ requestId: req.id, err }, 'Unhandled error');
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', 'An unexpected error occurred.', req.id));
  };
}
