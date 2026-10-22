export const PRICING_UNITS = ['item', 'kg', 'order'] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];

export interface Service {
  id: string;
  code: string;
  name: string;
  description?: string;
  pricingUnit: PricingUnit;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceDTO {
  code: string;
  name: string;
  description?: string;
  pricingUnit: PricingUnit;
  sortOrder: number;
}

export function toServiceDTO(service: Service): ServiceDTO {
  return {
    code: service.code,
    name: service.name,
    ...(service.description ? { description: service.description } : {}),
    pricingUnit: service.pricingUnit,
    sortOrder: service.sortOrder,
  };
}
