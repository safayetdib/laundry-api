import {
  ConflictError,
  NotFoundError,
  UnprocessableError,
  ValidationError,
} from '../../lib/errors';
import { CURRENCY, assertMinor, lineAmount, percentageOf, sumMinor } from '../../lib/money';
import type { AuditRepository } from '../audit/audit.repository';
import type { ServiceRepository } from '../catalogue/service.repository';
import type { CreatePriceListInput, PriceListRepository } from './pricelist.repository';
import type { PriceList, PriceListKind } from './pricelist.types';

export interface PricingServiceDeps {
  priceLists: PriceListRepository;
  services: ServiceRepository;
  audit: AuditRepository;
  now?: () => Date;
}

export interface PriceSelectionQuery {
  kind: PriceListKind;
  serviceCode: string;
  garmentCode?: string;
  zoneId?: string;
  partnerId?: string;
  at: Date;
}

export interface SelectedPrice {
  unitAmount: number;
  currency: string;
  priceListId: string;
  priceListVersion: number;
}

export interface QuoteItemInput {
  serviceCode: string;
  garmentCode?: string;
  quantity: number;
}

export interface QuoteLine extends QuoteItemInput {
  unitAmount: number;
  lineAmount: number;
  priceListId: string;
  priceListVersion: number;
}

export interface Quote {
  currency: string;
  lines: QuoteLine[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  tax: number;
  total: number;
}

export interface QuoteInput {
  items: QuoteItemInput[];
  zoneId?: string;
  deliveryFee?: number;
  discount?: number;
  taxBasisPoints?: number;
  at?: Date;
}

function isEffective(list: PriceList, at: Date): boolean {
  if (list.effectiveFrom.getTime() > at.getTime()) return false;
  if (list.effectiveTo && list.effectiveTo.getTime() <= at.getTime()) return false;
  return true;
}

export class PricingService {
  private readonly now: () => Date;

  constructor(private readonly deps: PricingServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async createPriceList(
    input: Omit<CreatePriceListInput, 'createdBy'>,
    actor: string,
    requestId?: string,
  ): Promise<PriceList> {
    if (input.entries.length === 0) {
      throw new ValidationError('A price list must have at least one entry.');
    }
    if (input.effectiveTo && input.effectiveTo.getTime() <= input.effectiveFrom.getTime()) {
      throw new ValidationError('effectiveTo must be after effectiveFrom.');
    }

    const seen = new Set<string>();
    for (const entry of input.entries) {
      assertMinor(entry.unitAmount, 'unitAmount');
      const service = await this.deps.services.findByCode(entry.serviceCode);
      if (!service) {
        throw new ValidationError(`Unknown service code: ${entry.serviceCode}`);
      }
      const key = `${entry.serviceCode}:${entry.garmentCode ?? ''}`;
      if (seen.has(key)) {
        throw new ValidationError(`Duplicate entry for ${key}`);
      }
      seen.add(key);
    }

    const list = await this.deps.priceLists.create({ ...input, createdBy: actor });
    await this.deps.audit.record({
      actor,
      action: 'price_list.created',
      resourceType: 'PriceList',
      resourceId: list.id,
      ...(requestId ? { requestId } : {}),
      summary: { kind: list.kind, version: list.version, entries: list.entries.length },
    });
    return list;
  }

  async publishPriceList(id: string, actor: string, requestId?: string): Promise<PriceList> {
    const list = await this.deps.priceLists.findById(id);
    if (!list) throw new NotFoundError('Price list not found.');
    if (list.status !== 'draft') {
      throw new ConflictError('Only a draft price list can be published.');
    }

    const published = await this.deps.priceLists.markPublished(id);
    await this.deps.audit.record({
      actor,
      action: 'price_list.published',
      resourceType: 'PriceList',
      resourceId: id,
      ...(requestId ? { requestId } : {}),
      summary: { kind: published.kind, version: published.version },
    });
    return published;
  }

  /**
   * Selects the single applicable unit price. Precedence: partner-specific >
   * general, zone-specific > default, exact garment > service default. If two
   * lists are equally specific, selection is rejected rather than guessed.
   */
  async selectPrice(query: PriceSelectionQuery): Promise<SelectedPrice> {
    const lists = await this.deps.priceLists.listPublished(query.kind);

    interface Candidate {
      specificity: number;
      unitAmount: number;
      priceListId: string;
      priceListVersion: number;
    }
    const candidates: Candidate[] = [];

    for (const list of lists) {
      if (!isEffective(list, query.at)) continue;
      if (list.partnerId && list.partnerId !== query.partnerId) continue;
      if (list.zoneId && list.zoneId !== query.zoneId) continue;

      const exact = query.garmentCode
        ? list.entries.find(
            (e) => e.serviceCode === query.serviceCode && e.garmentCode === query.garmentCode,
          )
        : undefined;
      const serviceDefault = list.entries.find(
        (e) => e.serviceCode === query.serviceCode && !e.garmentCode,
      );
      const entry = exact ?? serviceDefault;
      if (!entry) continue;

      const specificity = (list.partnerId ? 4 : 0) + (list.zoneId ? 2 : 0) + (exact ? 1 : 0);
      candidates.push({
        specificity,
        unitAmount: entry.unitAmount,
        priceListId: list.id,
        priceListVersion: list.version,
      });
    }

    if (candidates.length === 0) {
      throw new UnprocessableError('NO_PRICE: no applicable price found.', {
        serviceCode: query.serviceCode,
      });
    }

    const topSpecificity = Math.max(...candidates.map((c) => c.specificity));
    const top = candidates.filter((c) => c.specificity === topSpecificity);
    if (top.length > 1) {
      throw new UnprocessableError('AMBIGUOUS_PRICE: multiple equally applicable prices.', {
        serviceCode: query.serviceCode,
      });
    }

    const winner = top[0]!;
    return {
      unitAmount: winner.unitAmount,
      currency: CURRENCY,
      priceListId: winner.priceListId,
      priceListVersion: winner.priceListVersion,
    };
  }

  /** Builds a customer quote from items; the server is the source of every amount. */
  async calculateQuote(input: QuoteInput): Promise<Quote> {
    if (input.items.length === 0) {
      throw new ValidationError('A quote must have at least one item.');
    }
    const at = input.at ?? this.now();
    const deliveryFee = input.deliveryFee ?? 0;
    const discount = input.discount ?? 0;
    const taxBasisPoints = input.taxBasisPoints ?? 0;
    assertMinor(deliveryFee, 'deliveryFee');
    assertMinor(discount, 'discount');

    const lines: QuoteLine[] = [];
    for (const item of input.items) {
      const price = await this.selectPrice({
        kind: 'customer',
        serviceCode: item.serviceCode,
        ...(item.garmentCode ? { garmentCode: item.garmentCode } : {}),
        ...(input.zoneId ? { zoneId: input.zoneId } : {}),
        at,
      });
      lines.push({
        ...item,
        unitAmount: price.unitAmount,
        lineAmount: lineAmount(price.unitAmount, item.quantity),
        priceListId: price.priceListId,
        priceListVersion: price.priceListVersion,
      });
    }

    const subtotal = sumMinor(lines.map((l) => l.lineAmount));
    if (discount > subtotal) {
      throw new ValidationError('discount cannot exceed the subtotal.');
    }
    const taxableBase = subtotal - discount;
    const tax = percentageOf(taxableBase, taxBasisPoints);
    const total = taxableBase + tax + deliveryFee;

    return { currency: CURRENCY, lines, subtotal, deliveryFee, discount, tax, total };
  }
}
