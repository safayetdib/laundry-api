import { normalizeBdPhone } from '../lib/phone';
import type { AuthService } from '../modules/auth/auth.service';
import type { UserRepository } from '../modules/users/user.repository';
import type { Role } from '../modules/users/user.types';
import type { ServiceRepository } from '../modules/catalogue/service.repository';
import type { PricingUnit } from '../modules/catalogue/service.types';
import type { ZoneRepository } from '../modules/zones/zone.repository';
import type { SlotTemplate } from '../modules/zones/zone.types';
import type { PartnerRepository } from '../modules/partners/partner.repository';
import type { PriceListRepository } from '../modules/pricing/pricelist.repository';
import type { PricingService } from '../modules/pricing/pricing.service';

export interface SeedUserConfig {
  name: string;
  phone: string;
  password: string;
}

export interface SeedConfig {
  admin: SeedUserConfig;
  operations?: SeedUserConfig;
  partnerStaff?: SeedUserConfig;
  rider?: SeedUserConfig;
  services: {
    code: string;
    name: string;
    description?: string;
    pricingUnit: PricingUnit;
    sortOrder: number;
  }[];
  zone: { code: string; name: string; city: string; localities: string[]; slots: SlotTemplate[] };
  partner: { code: string; name: string };
  /** PLACEHOLDER amounts for development; replace with the real rate cards. */
  customerPrices: { serviceCode: string; unitAmount: number }[];
  partnerPrices: { serviceCode: string; unitAmount: number }[];
}

export interface SeedDeps {
  users: UserRepository;
  authService: AuthService;
  services: ServiceRepository;
  zones: ZoneRepository;
  partners: PartnerRepository;
  priceLists: PriceListRepository;
  pricingService: PricingService;
  log?: (message: string) => void;
}

export interface SeedSummary {
  created: string[];
  skipped: string[];
}

export async function runSeed(deps: SeedDeps, config: SeedConfig): Promise<SeedSummary> {
  const log = deps.log ?? (() => {});
  const created: string[] = [];
  const skipped: string[] = [];

  const ensureUser = async (
    cfg: SeedUserConfig,
    roles: Role[],
    partnerId?: string,
  ): Promise<string> => {
    const phone = normalizeBdPhone(cfg.phone);
    if (!phone) throw new Error(`Invalid phone for ${roles.join('/')} user: ${cfg.phone}`);
    const existing = await deps.users.findByPhone(phone);
    if (existing) {
      skipped.push(`user:${roles.join('+')}:${phone}`);
      return existing.id;
    }
    const user = await deps.authService.createUser({
      name: cfg.name,
      phone: cfg.phone,
      password: cfg.password,
      roles,
      ...(partnerId ? { partnerId } : {}),
    });
    created.push(`user:${roles.join('+')}:${phone}`);
    log(`created ${roles.join('+')} user ${phone}`);
    return user.id;
  };

  // Admin + optional operations user.
  const adminId = await ensureUser(config.admin, ['admin']);
  if (config.operations) await ensureUser(config.operations, ['operations']);

  // Services.
  for (const svc of config.services) {
    const existing = await deps.services.findByCode(svc.code);
    if (existing) {
      skipped.push(`service:${svc.code}`);
      continue;
    }
    await deps.services.create(svc);
    created.push(`service:${svc.code}`);
  }

  // Zone.
  let zone = await deps.zones.findByCode(config.zone.code);
  if (zone) {
    skipped.push(`zone:${config.zone.code}`);
  } else {
    zone = await deps.zones.create({
      code: config.zone.code,
      name: config.zone.name,
      city: config.zone.city,
      localities: config.zone.localities,
      slotTemplates: config.zone.slots,
    });
    created.push(`zone:${config.zone.code}`);
  }

  // Pilot partner.
  let partner = await deps.partners.findByCode(config.partner.code);
  if (partner) {
    skipped.push(`partner:${config.partner.code}`);
  } else {
    partner = await deps.partners.create({
      code: config.partner.code,
      name: config.partner.name,
      serviceCodes: config.services.map((s) => s.code),
      zoneIds: [zone.id],
    });
    created.push(`partner:${config.partner.code}`);
  }

  // Partner staff + rider (optional).
  if (config.partnerStaff) await ensureUser(config.partnerStaff, ['partner_staff'], partner.id);
  if (config.rider) await ensureUser(config.rider, ['rider']);

  // Published price lists — only if none exists yet (publishing is versioned,
  // so re-running must not stack duplicate published versions).
  const publishedCustomer = await deps.priceLists.listPublished('customer');
  if (publishedCustomer.length > 0) {
    skipped.push('priceList:customer');
  } else {
    const list = await deps.pricingService.createPriceList(
      {
        kind: 'customer',
        name: 'Pilot customer prices',
        effectiveFrom: new Date(),
        entries: config.customerPrices,
      },
      adminId,
    );
    await deps.pricingService.publishPriceList(list.id, adminId);
    created.push('priceList:customer');
    log(
      'WARNING: seeded PLACEHOLDER customer prices — replace with the real rate card before launch.',
    );
  }

  const publishedPartner = await deps.priceLists.listPublished('partner');
  if (publishedPartner.length > 0) {
    skipped.push('priceList:partner');
  } else {
    const list = await deps.pricingService.createPriceList(
      {
        kind: 'partner',
        name: 'Pilot partner rates',
        partnerId: partner.id,
        effectiveFrom: new Date(),
        entries: config.partnerPrices,
      },
      adminId,
    );
    await deps.pricingService.publishPriceList(list.id, adminId);
    created.push('priceList:partner');
    log(
      'WARNING: seeded PLACEHOLDER partner rates — replace with the agreed rate card before launch.',
    );
  }

  return { created, skipped };
}

/**
 * Default pilot config. Catalogue names/zones are safe structural data; the
 * prices are PLACEHOLDERS (poisha) that must be replaced with the real rate
 * cards before launch.
 */
export function defaultSeedConfig(
  admin: SeedUserConfig,
  overrides: Partial<SeedConfig> = {},
): SeedConfig {
  return {
    admin,
    services: [
      { code: 'wash_fold', name: 'Wash & Fold', pricingUnit: 'item', sortOrder: 1 },
      { code: 'wash_iron', name: 'Wash & Iron', pricingUnit: 'item', sortOrder: 2 },
      { code: 'iron', name: 'Iron Only', pricingUnit: 'item', sortOrder: 3 },
    ],
    zone: {
      code: 'ctg-central',
      name: 'Chattogram Central',
      city: 'Chattogram',
      localities: ['Agrabad', 'Halishahar'],
      slots: [
        { type: 'pickup', label: 'Morning (9am–12pm)', startHour: 9, endHour: 12, capacity: 20 },
        { type: 'delivery', label: 'Evening (5pm–8pm)', startHour: 17, endHour: 20, capacity: 20 },
      ],
    },
    partner: { code: 'PILOT', name: 'Pilot Laundry Partner' },
    customerPrices: [
      { serviceCode: 'wash_fold', unitAmount: 5000 },
      { serviceCode: 'wash_iron', unitAmount: 7000 },
      { serviceCode: 'iron', unitAmount: 3000 },
    ],
    partnerPrices: [
      { serviceCode: 'wash_fold', unitAmount: 3000 },
      { serviceCode: 'wash_iron', unitAmount: 4500 },
      { serviceCode: 'iron', unitAmount: 1800 },
    ],
    ...overrides,
  };
}
