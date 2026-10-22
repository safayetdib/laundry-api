import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../lib/logger';

/** Logs one structured line per request when the response finishes. */
export function requestLogger(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      logger.info(
        {
          requestId: req.id,
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs: Math.round(durationMs),
        },
        'request',
      );
    });

    next();
  };
}
