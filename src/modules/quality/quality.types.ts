export const QUALITY_TYPES = ['missing', 'damage', 'rework', 'complaint', 'other'] as const;
export type QualityType = (typeof QUALITY_TYPES)[number];

export const QUALITY_STATUSES = ['open', 'investigating', 'resolved'] as const;
export type QualityStatus = (typeof QUALITY_STATUSES)[number];

export interface QualityCase {
  id: string;
  orderId: string;
  type: QualityType;
  status: QualityStatus;
  description: string;
  evidenceKeys: string[];
  resolution?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QualityCaseDTO {
  id: string;
  orderId: string;
  type: QualityType;
  status: QualityStatus;
  description: string;
  evidenceKeys: string[];
  resolution?: string;
  createdAt: string;
}

export function toQualityCaseDTO(c: QualityCase): QualityCaseDTO {
  return {
    id: c.id,
    orderId: c.orderId,
    type: c.type,
    status: c.status,
    description: c.description,
    evidenceKeys: c.evidenceKeys,
    ...(c.resolution ? { resolution: c.resolution } : {}),
    createdAt: c.createdAt.toISOString(),
  };
}
