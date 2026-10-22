export const SLOT_TYPES = ['pickup', 'delivery'] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export interface SlotTemplate {
  type: SlotType;
  label: string;
  /** Local hour-of-day window [startHour, endHour), 0-24. */
  startHour: number;
  endHour: number;
  capacity: number;
}

export interface ServiceZone {
  id: string;
  code: string;
  name: string;
  city: string;
  active: boolean;
  localities: string[];
  slotTemplates: SlotTemplate[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ZoneDTO {
  id: string;
  code: string;
  name: string;
  city: string;
  localities: string[];
}

export function toZoneDTO(zone: ServiceZone): ZoneDTO {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    city: zone.city,
    localities: zone.localities,
  };
}
