export const PARTNER_STATUSES = ['active', 'inactive'] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface Partner {
  id: string;
  code: string;
  name: string;
  status: PartnerStatus;
  /** Service codes this partner can process. */
  serviceCodes: string[];
  /** Zone ids this partner serves. */
  zoneIds: string[];
  contact: { phone?: string; email?: string };
  createdAt: Date;
  updatedAt: Date;
}

export interface PartnerDTO {
  id: string;
  code: string;
  name: string;
  status: PartnerStatus;
  serviceCodes: string[];
  zoneIds: string[];
}

export function toPartnerDTO(partner: Partner): PartnerDTO {
  return {
    id: partner.id,
    code: partner.code,
    name: partner.name,
    status: partner.status,
    serviceCodes: partner.serviceCodes,
    zoneIds: partner.zoneIds,
  };
}
