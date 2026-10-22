export const PRICE_LIST_KINDS = ['customer', 'partner'] as const;
export type PriceListKind = (typeof PRICE_LIST_KINDS)[number];

export const PRICE_LIST_STATUSES = ['draft', 'published', 'archived'] as const;
export type PriceListStatus = (typeof PRICE_LIST_STATUSES)[number];

export interface PriceEntry {
  serviceCode: string;
  /** Optional garment specialization; absent entry is the service-level default. */
  garmentCode?: string;
  unitAmount: number;
}

export interface PriceList {
  id: string;
  kind: PriceListKind;
  name: string;
  /** Partner scope (partner rate cards, or partner-specific customer pricing). */
  partnerId?: string;
  /** Zone scope; absent means the default (any zone). */
  zoneId?: string;
  currency: string;
  version: number;
  status: PriceListStatus;
  effectiveFrom: Date;
  effectiveTo?: Date;
  entries: PriceEntry[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceListDTO {
  id: string;
  kind: PriceListKind;
  name: string;
  partnerId?: string;
  zoneId?: string;
  currency: string;
  version: number;
  status: PriceListStatus;
  effectiveFrom: string;
  effectiveTo?: string;
  entries: PriceEntry[];
}

export function toPriceListDTO(list: PriceList): PriceListDTO {
  return {
    id: list.id,
    kind: list.kind,
    name: list.name,
    ...(list.partnerId ? { partnerId: list.partnerId } : {}),
    ...(list.zoneId ? { zoneId: list.zoneId } : {}),
    currency: list.currency,
    version: list.version,
    status: list.status,
    effectiveFrom: list.effectiveFrom.toISOString(),
    ...(list.effectiveTo ? { effectiveTo: list.effectiveTo.toISOString() } : {}),
    entries: list.entries,
  };
}
