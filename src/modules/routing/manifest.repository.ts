import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../lib/errors';
import type { ManifestStatus, RouteManifest, RouteStop } from './manifest.types';

export interface CreateManifestData {
  date: string;
  notes?: string;
  vehicleCapacity?: number;
}

export interface ManifestChanges {
  status?: ManifestStatus;
  riderId?: string;
  notes?: string;
  stops?: RouteStop[];
}

export interface ManifestRepository {
  create(data: CreateManifestData): Promise<RouteManifest>;
  findById(id: string): Promise<RouteManifest | null>;
  listByRider(riderId: string): Promise<RouteManifest[]>;
  update(id: string, expectedVersion: number, changes: ManifestChanges): Promise<RouteManifest>;
}

export class InMemoryManifestRepository implements ManifestRepository {
  private readonly byId = new Map<string, RouteManifest>();

  async create(data: CreateManifestData): Promise<RouteManifest> {
    const now = new Date();
    const manifest: RouteManifest = {
      id: randomUUID(),
      date: data.date,
      status: 'draft',
      ...(data.notes ? { notes: data.notes } : {}),
      ...(data.vehicleCapacity !== undefined ? { vehicleCapacity: data.vehicleCapacity } : {}),
      stops: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(manifest.id, manifest);
    return structuredClone(manifest);
  }

  async findById(id: string): Promise<RouteManifest | null> {
    const m = this.byId.get(id);
    return m ? structuredClone(m) : null;
  }

  async listByRider(riderId: string): Promise<RouteManifest[]> {
    return [...this.byId.values()]
      .filter((m) => m.riderId === riderId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((m) => structuredClone(m));
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: ManifestChanges,
  ): Promise<RouteManifest> {
    const m = this.byId.get(id);
    if (!m) throw new ConflictError('Manifest not found.');
    if (m.version !== expectedVersion) {
      throw new ConflictError('The manifest has changed. Refresh and try again.');
    }
    const updated: RouteManifest = {
      ...m,
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.riderId ? { riderId: changes.riderId } : {}),
      ...(changes.notes ? { notes: changes.notes } : {}),
      ...(changes.stops ? { stops: changes.stops } : {}),
      version: m.version + 1,
      updatedAt: new Date(),
    };
    this.byId.set(id, updated);
    return structuredClone(updated);
  }
}

export function makeStop(
  input: {
    type: RouteStop['type'];
    orderId?: string;
    deliveryTaskId?: string;
  },
  sequence: number,
): RouteStop {
  return {
    id: randomUUID(),
    sequence,
    type: input.type,
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.deliveryTaskId ? { deliveryTaskId: input.deliveryTaskId } : {}),
    status: 'pending',
  };
}
