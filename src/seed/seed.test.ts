import { describe, it, expect } from 'vitest';
import { defaultSeedConfig, runSeed, type SeedDeps } from './seed';
import { InMemoryUserRepository } from '../modules/users/user.repository';
import { InMemorySessionRepository } from '../modules/auth/session.repository';
import { AuthService } from '../modules/auth/auth.service';
import { InMemoryServiceRepository } from '../modules/catalogue/service.repository';
import { InMemoryZoneRepository } from '../modules/zones/zone.repository';
import { InMemoryPartnerRepository } from '../modules/partners/partner.repository';
import { InMemoryPriceListRepository } from '../modules/pricing/pricelist.repository';
import { InMemoryAuditRepository } from '../modules/audit/audit.repository';
import { PricingService } from '../modules/pricing/pricing.service';

const admin = { name: 'Admin', phone: '01710000000', password: 'admin-pass-123' };

function setup() {
  const users = new InMemoryUserRepository();
  const authService = new AuthService({
    users,
    sessions: new InMemorySessionRepository(),
    sessionTtlMs: 3_600_000,
  });
  const services = new InMemoryServiceRepository();
  const zones = new InMemoryZoneRepository();
  const partners = new InMemoryPartnerRepository();
  const priceLists = new InMemoryPriceListRepository();
  const pricingService = new PricingService({
    priceLists,
    services,
    audit: new InMemoryAuditRepository(),
  });
  const deps: SeedDeps = {
    users,
    authService,
    services,
    zones,
    partners,
    priceLists,
    pricingService,
  };
  return { deps, users, authService, services, zones, partners, priceLists, pricingService };
}

const config = defaultSeedConfig(admin, {
  partnerStaff: { name: 'PS', phone: '01720000000', password: 'partner-pass-1' },
  rider: { name: 'Rider', phone: '01730000000', password: 'rider-pass-12' },
});

describe('runSeed', () => {
  it('bootstraps admin, catalogue, zone, partner, staff and published prices', async () => {
    const ctx = setup();
    const summary = await runSeed(ctx.deps, config);

    expect(summary.created).toContain('user:admin:+8801710000000');
    expect((await ctx.services.listActive()).map((s) => s.code)).toEqual([
      'wash_fold',
      'wash_iron',
      'iron',
    ]);
    const zone = await ctx.zones.findByCode('ctg-central');
    expect(zone).not.toBeNull();
    expect(await ctx.partners.findByCode('PILOT')).not.toBeNull();

    // Seeded users can authenticate.
    await expect(ctx.authService.login(admin.phone, admin.password)).resolves.toBeTruthy();

    // Published customer prices are usable by the quote engine.
    const price = await ctx.pricingService.selectPrice({
      kind: 'customer',
      serviceCode: 'wash_fold',
      zoneId: zone!.id,
      at: new Date(),
    });
    expect(price.unitAmount).toBe(5000);
  });

  it('is idempotent — a second run creates nothing and does not duplicate', async () => {
    const ctx = setup();
    await runSeed(ctx.deps, config);
    const second = await runSeed(ctx.deps, config);

    expect(second.created).toEqual([]);
    expect(await ctx.services.listActive()).toHaveLength(3);
    expect(await ctx.priceLists.listPublished('customer')).toHaveLength(1);
    expect(await ctx.priceLists.listPublished('partner')).toHaveLength(1);
  });

  it('creates partner staff scoped to the pilot partner', async () => {
    const ctx = setup();
    await runSeed(ctx.deps, config);
    const partner = await ctx.partners.findByCode('PILOT');
    const ps = await ctx.users.findByPhone('+8801720000000');
    expect(ps?.roles).toContain('partner_staff');
    expect(ps?.partnerId).toBe(partner!.id);
  });
});
