import { describe, it, expect, beforeEach } from 'vitest';
import { PricingService } from './pricing.service';
import { InMemoryPriceListRepository } from './pricelist.repository';
import { InMemoryServiceRepository } from '../catalogue/service.repository';
import { InMemoryAuditRepository } from '../audit/audit.repository';
import type { PriceEntry } from './pricelist.types';

const AT = new Date('2026-06-01T00:00:00Z');

function setup() {
  const services = new InMemoryServiceRepository();
  const priceLists = new InMemoryPriceListRepository();
  const audit = new InMemoryAuditRepository();
  const service = new PricingService({ services, priceLists, audit, now: () => AT });
  return { services, priceLists, audit, service };
}

async function publishList(
  service: PricingService,
  opts: {
    entries: PriceEntry[];
    zoneId?: string;
    partnerId?: string;
    effectiveFrom?: Date;
    effectiveTo?: Date;
  },
) {
  const list = await service.createPriceList(
    {
      kind: 'customer',
      name: 'list',
      ...(opts.zoneId ? { zoneId: opts.zoneId } : {}),
      ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
      effectiveFrom: opts.effectiveFrom ?? new Date('2026-01-01T00:00:00Z'),
      ...(opts.effectiveTo ? { effectiveTo: opts.effectiveTo } : {}),
      entries: opts.entries,
    },
    'admin-1',
  );
  return service.publishPriceList(list.id, 'admin-1');
}

describe('PricingService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(async () => {
    ctx = setup();
    await ctx.services.create({ code: 'wash_fold', name: 'Wash & Fold', pricingUnit: 'item' });
    await ctx.services.create({ code: 'iron', name: 'Iron', pricingUnit: 'item' });
  });

  it('rejects a price list referencing an unknown service', async () => {
    await expect(
      ctx.service.createPriceList(
        {
          kind: 'customer',
          name: 'x',
          effectiveFrom: AT,
          entries: [{ serviceCode: 'nope', unitAmount: 100 }],
        },
        'admin-1',
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('records an audit entry on publish', async () => {
    const list = await publishList(ctx.service, {
      entries: [{ serviceCode: 'wash_fold', unitAmount: 5000 }],
    });
    const log = await ctx.audit.listByResource('PriceList', list.id);
    expect(log.some((e) => e.action === 'price_list.published')).toBe(true);
  });

  it('selects a zone-specific price over the default', async () => {
    await publishList(ctx.service, { entries: [{ serviceCode: 'wash_fold', unitAmount: 10000 }] });
    await publishList(ctx.service, {
      zoneId: 'zone-A',
      entries: [{ serviceCode: 'wash_fold', unitAmount: 12000 }],
    });

    const withZone = await ctx.service.selectPrice({
      kind: 'customer',
      serviceCode: 'wash_fold',
      zoneId: 'zone-A',
      at: AT,
    });
    expect(withZone.unitAmount).toBe(12000);

    const noZone = await ctx.service.selectPrice({
      kind: 'customer',
      serviceCode: 'wash_fold',
      at: AT,
    });
    expect(noZone.unitAmount).toBe(10000);
  });

  it('prefers an exact garment entry over the service default', async () => {
    await publishList(ctx.service, {
      entries: [
        { serviceCode: 'wash_fold', unitAmount: 10000 },
        { serviceCode: 'wash_fold', garmentCode: 'blanket', unitAmount: 30000 },
      ],
    });

    const blanket = await ctx.service.selectPrice({
      kind: 'customer',
      serviceCode: 'wash_fold',
      garmentCode: 'blanket',
      at: AT,
    });
    expect(blanket.unitAmount).toBe(30000);
  });

  it('rejects ambiguous equally-specific prices rather than guessing', async () => {
    await publishList(ctx.service, { entries: [{ serviceCode: 'wash_fold', unitAmount: 10000 }] });
    await publishList(ctx.service, { entries: [{ serviceCode: 'wash_fold', unitAmount: 11000 }] });

    await expect(
      ctx.service.selectPrice({ kind: 'customer', serviceCode: 'wash_fold', at: AT }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects when no price is applicable', async () => {
    await expect(
      ctx.service.selectPrice({ kind: 'customer', serviceCode: 'iron', at: AT }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('ignores lists outside their effective window', async () => {
    await publishList(ctx.service, {
      effectiveFrom: new Date('2026-07-01T00:00:00Z'), // future relative to AT
      entries: [{ serviceCode: 'wash_fold', unitAmount: 10000 }],
    });
    await expect(
      ctx.service.selectPrice({ kind: 'customer', serviceCode: 'wash_fold', at: AT }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('calculates a quote with line amounts, tax and delivery', async () => {
    await publishList(ctx.service, {
      entries: [
        { serviceCode: 'wash_fold', unitAmount: 5000 },
        { serviceCode: 'iron', unitAmount: 3000 },
      ],
    });

    const quote = await ctx.service.calculateQuote({
      items: [
        { serviceCode: 'wash_fold', quantity: 3 },
        { serviceCode: 'iron', quantity: 2 },
      ],
      deliveryFee: 6000,
      taxBasisPoints: 500, // 5%
      at: AT,
    });

    // subtotal = 15000 + 6000 = 21000; tax = 5% = 1050; total = 21000 + 1050 + 6000
    expect(quote.subtotal).toBe(21000);
    expect(quote.tax).toBe(1050);
    expect(quote.total).toBe(28050);
    expect(quote.lines).toHaveLength(2);
    expect(quote.lines[0]?.priceListVersion).toBe(1);
  });

  it('rejects a discount larger than the subtotal', async () => {
    await publishList(ctx.service, { entries: [{ serviceCode: 'wash_fold', unitAmount: 5000 }] });
    await expect(
      ctx.service.calculateQuote({
        items: [{ serviceCode: 'wash_fold', quantity: 1 }],
        discount: 9999999,
        at: AT,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
