import type { ServiceZone, SlotType } from './zone.types';

export interface AvailableSlot {
  type: SlotType;
  label: string;
  start: string;
  end: string;
  capacity: number;
}

/**
 * Generates the configured slot windows for a zone on a given date. Windows
 * are built from the zone's slot templates (hour-of-day in UTC for the pilot;
 * timezone handling is documented as an open question).
 *
 * This returns the *configured* capacity. Remaining capacity after
 * reservations is computed in Milestone 4 once SlotReservation exists.
 */
export function generateAvailability(zone: ServiceZone, date: Date): AvailableSlot[] {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  return zone.slotTemplates.map((template) => {
    const start = new Date(Date.UTC(year, month, day, template.startHour, 0, 0));
    const end = new Date(Date.UTC(year, month, day, template.endHour, 0, 0));
    return {
      type: template.type,
      label: template.label,
      start: start.toISOString(),
      end: end.toISOString(),
      capacity: template.capacity,
    };
  });
}
