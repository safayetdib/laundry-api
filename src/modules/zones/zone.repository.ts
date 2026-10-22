import { randomUUID } from 'node:crypto';
import type { ServiceZone, SlotTemplate } from './zone.types';

export interface CreateZoneInput {
  code: string;
  name: string;
  city: string;
  active?: boolean;
  localities?: string[];
  slotTemplates?: SlotTemplate[];
}

export interface ZoneRepository {
  listActive(): Promise<ServiceZone[]>;
  findById(id: string): Promise<ServiceZone | null>;
  findByCode(code: string): Promise<ServiceZone | null>;
  create(input: CreateZoneInput): Promise<ServiceZone>;
}

export class InMemoryZoneRepository implements ZoneRepository {
  private readonly byId = new Map<string, ServiceZone>();

  async listActive(): Promise<ServiceZone[]> {
    return [...this.byId.values()]
      .filter((zone) => zone.active)
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  async findById(id: string): Promise<ServiceZone | null> {
    return this.byId.get(id) ?? null;
  }

  async findByCode(code: string): Promise<ServiceZone | null> {
    for (const zone of this.byId.values()) {
      if (zone.code === code) return zone;
    }
    return null;
  }

  async create(input: CreateZoneInput): Promise<ServiceZone> {
    const now = new Date();
    const zone: ServiceZone = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      city: input.city,
      active: input.active ?? true,
      localities: input.localities ?? [],
      slotTemplates: input.slotTemplates ?? [],
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(zone.id, zone);
    return zone;
  }
}
