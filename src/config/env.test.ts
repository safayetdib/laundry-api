import { describe, it, expect } from 'vitest';
import { loadEnv } from './env';

describe('loadEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = loadEnv({ MONGODB_URI: 'mongodb://localhost/x' });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('coerces PORT and defaults LOG_LEVEL to silent in test', () => {
    const env = loadEnv({ MONGODB_URI: 'mongodb://x', NODE_ENV: 'test', PORT: '8080' });

    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe('silent');
  });

  it('throws a clear error when MONGODB_URI is missing', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI/);
  });

  it('throws on an invalid PORT', () => {
    expect(() => loadEnv({ MONGODB_URI: 'mongodb://x', PORT: '-1' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
