import { describe, it, expect } from 'vitest';
import { generateAvailability } from './zone.availability';
import type { ServiceZone } from './zone.types';

const zone: ServiceZone = {
  id: 'z1',
  code: 'ctg-central',
  name: 'Central',
  city: 'Chattogram',
  active: true,
  localities: ['Agrabad'],
  slotTemplates: [
    { type: 'pickup', label: 'Morning', startHour: 9, endHour: 12, capacity: 10 },
    { type: 'delivery', label: 'Evening', startHour: 17, endHour: 20, capacity: 8 },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('generateAvailability', () => {
  it('builds one slot per template with ISO windows and capacity', () => {
    const slots = generateAvailability(zone, new Date('2026-06-01T00:00:00Z'));
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({
      type: 'pickup',
      label: 'Morning',
      start: '2026-06-01T09:00:00.000Z',
      end: '2026-06-01T12:00:00.000Z',
      capacity: 10,
    });
    expect(slots[1]?.type).toBe('delivery');
  });

  it('returns no slots when the zone has no templates', () => {
    expect(generateAvailability({ ...zone, slotTemplates: [] }, new Date())).toEqual([]);
  });
});
