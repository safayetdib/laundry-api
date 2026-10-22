import { createApp } from './app';
import { loadEnv } from './config/env';
import { createLogger } from './lib/logger';
import { connectDb, disconnectDb, dbReadiness } from './lib/db';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL);

  try {
    await connectDb(env.MONGODB_URI);
    logger.info('Connected to MongoDB');
  } catch (err) {
    logger.error({ err }, 'Failed to connect to MongoDB');
    process.exit(1);
  }

  const app = createApp({ logger, checkReadiness: dbReadiness });
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'laundry-api listening');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDb().finally(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      });
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // Logger may not exist yet if config failed; use console as a last resort.
  console.error(err);
  process.exit(1);
});
