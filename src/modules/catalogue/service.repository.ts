import { randomUUID } from 'node:crypto';
import type { PricingUnit, Service } from './service.types';

export interface CreateServiceInput {
  code: string;
  name: string;
  description?: string;
  pricingUnit: PricingUnit;
  active?: boolean;
  sortOrder?: number;
}

export interface ServiceRepository {
  listActive(): Promise<Service[]>;
  findByCode(code: string): Promise<Service | null>;
  create(input: CreateServiceInput): Promise<Service>;
}

export class InMemoryServiceRepository implements ServiceRepository {
  private readonly byId = new Map<string, Service>();

  async listActive(): Promise<Service[]> {
    return [...this.byId.values()]
      .filter((service) => service.active)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  }

  async findByCode(code: string): Promise<Service | null> {
    for (const service of this.byId.values()) {
      if (service.code === code) return service;
    }
    return null;
  }

  async create(input: CreateServiceInput): Promise<Service> {
    const now = new Date();
    const service: Service = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      pricingUnit: input.pricingUnit,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(service.id, service);
    return service;
  }
}
