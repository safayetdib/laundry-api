import { randomUUID } from 'node:crypto';
import { CURRENCY } from '../../lib/money';
import type { PriceEntry, PriceList, PriceListKind } from './pricelist.types';

export interface CreatePriceListInput {
  kind: PriceListKind;
  name: string;
  partnerId?: string;
  zoneId?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  entries: PriceEntry[];
  createdBy: string;
}

export interface PriceListRepository {
  create(input: CreatePriceListInput): Promise<PriceList>;
  findById(id: string): Promise<PriceList | null>;
  /** Marks a draft list published. */
  markPublished(id: string): Promise<PriceList>;
  /** All published lists of a kind (selection filters further in the service). */
  listPublished(kind: PriceListKind): Promise<PriceList[]>;
}

function scopeKey(kind: string, partnerId?: string, zoneId?: string): string {
  return `${kind}:${partnerId ?? '-'}:${zoneId ?? '-'}`;
}

export class InMemoryPriceListRepository implements PriceListRepository {
  private readonly byId = new Map<string, PriceList>();

  private nextVersion(input: CreatePriceListInput): number {
    const key = scopeKey(input.kind, input.partnerId, input.zoneId);
    let max = 0;
    for (const list of this.byId.values()) {
      if (scopeKey(list.kind, list.partnerId, list.zoneId) === key) {
        max = Math.max(max, list.version);
      }
    }
    return max + 1;
  }

  async create(input: CreatePriceListInput): Promise<PriceList> {
    const now = new Date();
    const list: PriceList = {
      id: randomUUID(),
      kind: input.kind,
      name: input.name,
      ...(input.partnerId ? { partnerId: input.partnerId } : {}),
      ...(input.zoneId ? { zoneId: input.zoneId } : {}),
      currency: CURRENCY,
      version: this.nextVersion(input),
      status: 'draft',
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo ? { effectiveTo: input.effectiveTo } : {}),
      entries: input.entries,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(list.id, list);
    return list;
  }

  async findById(id: string): Promise<PriceList | null> {
    return this.byId.get(id) ?? null;
  }

  async markPublished(id: string): Promise<PriceList> {
    const list = this.byId.get(id);
    if (!list) throw new Error('NOT_FOUND');
    list.status = 'published';
    list.updatedAt = new Date();
    return list;
  }

  async listPublished(kind: PriceListKind): Promise<PriceList[]> {
    return [...this.byId.values()].filter(
      (list) => list.kind === kind && list.status === 'published',
    );
  }
}
