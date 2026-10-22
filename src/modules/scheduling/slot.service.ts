import { ConflictError, ValidationError } from '../../lib/errors';
import type { ServiceZone, SlotType } from '../zones/zone.types';
import type { SlotRepository } from './slot.repository';

export interface ReservedSlot {
  slotKey: string;
  type: SlotType;
  start: string;
  end: string;
}

/** Builds the stable key identifying a dated slot instance. */
export function slotKeyOf(zoneId: string, type: SlotType, startIso: string): string {
  return `${zoneId}:${type}:${startIso}`;
}

export class SlotService {
  constructor(private readonly slots: SlotRepository) {}

  /**
   * Atomically reserves capacity for a dated slot that matches one of the
   * zone's templates. Throws SLOT_FULL when the slot is at capacity.
   */
  async reserve(zone: ServiceZone, type: SlotType, startIso: string): Promise<ReservedSlot> {
    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) {
      throw new ValidationError('Invalid slot start time.');
    }
    const template = zone.slotTemplates.find(
      (t) => t.type === type && t.startHour === start.getUTCHours(),
    );
    if (!template) {
      throw new ValidationError('Requested slot is not offered for this zone.');
    }

    const key = slotKeyOf(zone.id, type, startIso);
    const reserved = await this.slots.reserve(key, template.capacity);
    if (!reserved) {
      throw new ConflictError('The selected slot is full. Please choose another.');
    }

    const end = new Date(start);
    end.setUTCHours(template.endHour, 0, 0, 0);
    return { slotKey: key, type, start: start.toISOString(), end: end.toISOString() };
  }

  async release(slotKey: string): Promise<void> {
    await this.slots.release(slotKey);
  }
}
