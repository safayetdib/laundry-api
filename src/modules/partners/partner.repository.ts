import { randomUUID } from 'node:crypto';
import type { Partner, PartnerStatus } from './partner.types';

export interface CreatePartnerInput {
  code: string;
  name: string;
  status?: PartnerStatus;
  serviceCodes?: string[];
  zoneIds?: string[];
  contact?: { phone?: string; email?: string };
}

export interface PartnerRepository {
  listAll(): Promise<Partner[]>;
  findById(id: string): Promise<Partner | null>;
  findByCode(code: string): Promise<Partner | null>;
  create(input: CreatePartnerInput): Promise<Partner>;
}

export class InMemoryPartnerRepository implements PartnerRepository {
  private readonly byId = new Map<string, Partner>();

  async listAll(): Promise<Partner[]> {
    return [...this.byId.values()].sort((a, b) => a.code.localeCompare(b.code));
  }

  async findById(id: string): Promise<Partner | null> {
    return this.byId.get(id) ?? null;
  }

  async findByCode(code: string): Promise<Partner | null> {
    for (const partner of this.byId.values()) {
      if (partner.code === code) return partner;
    }
    return null;
  }

  async create(input: CreatePartnerInput): Promise<Partner> {
    const existing = await this.findByCode(input.code);
    if (existing) throw new Error('DUPLICATE_CODE');
    const now = new Date();
    const partner: Partner = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      status: input.status ?? 'active',
      serviceCodes: input.serviceCodes ?? [],
      zoneIds: input.zoneIds ?? [],
      contact: input.contact ?? {},
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(partner.id, partner);
    return partner;
  }
}
