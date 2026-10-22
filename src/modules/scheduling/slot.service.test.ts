import { describe, it, expect } from 'vitest';
import { SlotService } from './slot.service';
import { InMemorySlotRepository } from './slot.repository';
import type { ServiceZone } from '../zones/zone.types';

const zone: ServiceZone = {
  id: 'z1',
  code: 'ctg',
  name: 'Central',
  city: 'Chattogram',
  active: true,
  localities: [],
  slotTemplates: [{ type: 'pickup', label: 'AM', startHour: 9, endHour: 12, capacity: 2 }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const START = '2026-06-01T09:00:00.000Z';

describe('SlotService', () => {
  it('reserves up to capacity then rejects (no oversell)', async () => {
    const service = new SlotService(new InMemorySlotRepository());
    await service.reserve(zone, 'pickup', START);
    await service.reserve(zone, 'pickup', START);
    await expect(service.reserve(zone, 'pickup', START)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('releases capacity so it can be reserved again', async () => {
    const repo = new InMemorySlotRepository();
    const service = new SlotService(repo);
    const r = await service.reserve(zone, 'pickup', START);
    await service.reserve(zone, 'pickup', START);
    await service.release(r.slotKey);
    await expect(service.reserve(zone, 'pickup', START)).resolves.toBeTruthy();
  });

  it('rejects a slot that matches no template', async () => {
    const service = new SlotService(new InMemorySlotRepository());
    await expect(service.reserve(zone, 'pickup', '2026-06-01T15:00:00.000Z')).rejects.toMatchObject(
      { statusCode: 400 },
    );
  });
});
