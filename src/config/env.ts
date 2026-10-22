import { z } from 'zod';

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  LOG_LEVEL: z.enum(LOG_LEVELS).optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
});

type RawEnv = z.infer<typeof envSchema>;

export interface Env extends RawEnv {
  LOG_LEVEL: (typeof LOG_LEVELS)[number];
  /** Whether session cookies set the Secure flag (true in production). */
  COOKIE_SECURE_RESOLVED: boolean;
}

function defaultLogLevel(nodeEnv: RawEnv['NODE_ENV']): Env['LOG_LEVEL'] {
  if (nodeEnv === 'test') return 'silent';
  if (nodeEnv === 'production') return 'info';
  return 'debug';
}

/**
 * Parses and validates process environment. Throws with a clear, aggregated
 * message so invalid configuration fails fast and legibly at startup.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  const data = parsed.data;
  return {
    ...data,
    LOG_LEVEL: data.LOG_LEVEL ?? defaultLogLevel(data.NODE_ENV),
    COOKIE_SECURE_RESOLVED:
      data.COOKIE_SECURE !== undefined
        ? data.COOKIE_SECURE === 'true'
        : data.NODE_ENV === 'production',
  };
}
