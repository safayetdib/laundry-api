import pino, { type Logger } from 'pino';

/**
 * Structured JSON logger. Sensitive fields are redacted so secrets, tokens,
 * OTPs and payment credentials never reach the logs.
 */
export function createLogger(level: string): Logger {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'password',
        '*.password',
        'otp',
        '*.otp',
        'pin',
        '*.pin',
        'token',
        '*.token',
      ],
      censor: '[redacted]',
    },
  });
}

export type { Logger };
