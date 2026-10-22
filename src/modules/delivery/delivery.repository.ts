import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../lib/errors';
import type { DeliveryTask, DeliveryTaskStatus, DeliveryTaskType } from './delivery.types';

export interface CreateDeliveryTaskData {
  orderId: string;
  type: DeliveryTaskType;
  riderId?: string;
  manifestId?: string;
  scheduledStart: string;
  scheduledEnd: string;
}

export interface DeliveryTaskChanges {
  status?: DeliveryTaskStatus;
  riderId?: string;
  manifestId?: string;
  attempts?: number;
  failureReason?: string;
  evidenceKeys?: string[];
  codAmountCollected?: number;
  completedAt?: Date;
}

export interface DeliveryTaskRepository {
  create(data: CreateDeliveryTaskData): Promise<DeliveryTask>;
  findById(id: string): Promise<DeliveryTask | null>;
  listByOrder(orderId: string): Promise<DeliveryTask[]>;
  listByRider(riderId: string): Promise<DeliveryTask[]>;
  update(id: string, expectedVersion: number, changes: DeliveryTaskChanges): Promise<DeliveryTask>;
}

export class InMemoryDeliveryTaskRepository implements DeliveryTaskRepository {
  private readonly byId = new Map<string, DeliveryTask>();

  async create(data: CreateDeliveryTaskData): Promise<DeliveryTask> {
    const now = new Date();
    const task: DeliveryTask = {
      id: randomUUID(),
      orderId: data.orderId,
      type: data.type,
      ...(data.riderId ? { riderId: data.riderId } : {}),
      ...(data.manifestId ? { manifestId: data.manifestId } : {}),
      status: 'scheduled',
      scheduledStart: data.scheduledStart,
      scheduledEnd: data.scheduledEnd,
      attempts: 0,
      evidenceKeys: [],
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(task.id, task);
    return structuredClone(task);
  }

  async findById(id: string): Promise<DeliveryTask | null> {
    const t = this.byId.get(id);
    return t ? structuredClone(t) : null;
  }

  async listByOrder(orderId: string): Promise<DeliveryTask[]> {
    return [...this.byId.values()]
      .filter((t) => t.orderId === orderId)
      .map((t) => structuredClone(t));
  }

  async listByRider(riderId: string): Promise<DeliveryTask[]> {
    return [...this.byId.values()]
      .filter((t) => t.riderId === riderId)
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart))
      .map((t) => structuredClone(t));
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: DeliveryTaskChanges,
  ): Promise<DeliveryTask> {
    const t = this.byId.get(id);
    if (!t) throw new ConflictError('Delivery task not found.');
    if (t.version !== expectedVersion) {
      throw new ConflictError('The delivery task has changed. Refresh and try again.');
    }
    const updated: DeliveryTask = {
      ...t,
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.riderId ? { riderId: changes.riderId } : {}),
      ...(changes.manifestId ? { manifestId: changes.manifestId } : {}),
      ...(changes.attempts !== undefined ? { attempts: changes.attempts } : {}),
      ...(changes.failureReason ? { failureReason: changes.failureReason } : {}),
      ...(changes.evidenceKeys ? { evidenceKeys: changes.evidenceKeys } : {}),
      ...(changes.codAmountCollected !== undefined
        ? { codAmountCollected: changes.codAmountCollected }
        : {}),
      ...(changes.completedAt ? { completedAt: changes.completedAt } : {}),
      version: t.version + 1,
      updatedAt: new Date(),
    };
    this.byId.set(id, updated);
    return structuredClone(updated);
  }
}
