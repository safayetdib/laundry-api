// Load a local .env (if present) before reading config. See src/server.ts.
import 'dotenv/config';
import { loadEnv } from '../config/env';
import { createLogger } from '../lib/logger';
import { connectDb, disconnectDb } from '../lib/db';
import { AuthService } from '../modules/auth/auth.service';
import { MongoUserRepository } from '../modules/users/user.model';
import { MongoSessionRepository } from '../modules/auth/session.model';
import { MongoServiceRepository } from '../modules/catalogue/service.model';
import { MongoZoneRepository } from '../modules/zones/zone.model';
import { MongoPartnerRepository } from '../modules/partners/partner.model';
import { MongoPriceListRepository } from '../modules/pricing/pricelist.model';
import { MongoAuditRepository } from '../modules/audit/audit.model';
import { PricingService } from '../modules/pricing/pricing.service';
import { defaultSeedConfig, runSeed, type SeedUserConfig } from './seed';

function readUser(prefix: string, name: string): SeedUserConfig | undefined {
  const phone = process.env[`${prefix}_PHONE`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!phone || !password) return undefined;
  return { name, phone, password };
}

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env.LOG_LEVEL === 'silent' ? 'info' : env.LOG_LEVEL);

  const admin = readUser('SEED_ADMIN', 'Folded Admin');
  if (!admin) {
    logger.error('SEED_ADMIN_PHONE and SEED_ADMIN_PASSWORD are required to seed an admin user.');
    process.exit(1);
  }

  const config = defaultSeedConfig(admin, {
    ...(readUser('SEED_OPS', 'Folded Operations')
      ? { operations: readUser('SEED_OPS', 'Folded Operations') }
      : {}),
    ...(readUser('SEED_PARTNER_STAFF', 'Pilot Partner Staff')
      ? { partnerStaff: readUser('SEED_PARTNER_STAFF', 'Pilot Partner Staff') }
      : {}),
    ...(readUser('SEED_RIDER', 'Pilot Rider')
      ? { rider: readUser('SEED_RIDER', 'Pilot Rider') }
      : {}),
  });

  await connectDb(env.MONGODB_URI);
  try {
    const services = new MongoServiceRepository();
    const priceLists = new MongoPriceListRepository();
    const summary = await runSeed(
      {
        users: new MongoUserRepository(),
        authService: new AuthService({
          users: new MongoUserRepository(),
          sessions: new MongoSessionRepository(),
          sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
        }),
        services,
        zones: new MongoZoneRepository(),
        partners: new MongoPartnerRepository(),
        priceLists,
        pricingService: new PricingService({
          priceLists,
          services,
          audit: new MongoAuditRepository(),
        }),
        log: (m) => logger.info(m),
      },
      config,
    );
    logger.info({ created: summary.created, skipped: summary.skipped }, 'Seed complete');
  } finally {
    await disconnectDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
