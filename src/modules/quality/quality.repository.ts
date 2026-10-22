import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../lib/errors';
import type { QualityCase, QualityStatus, QualityType } from './quality.types';

export interface CreateQualityCaseData {
  orderId: string;
  type: QualityType;
  description: string;
  evidenceKeys?: string[];
  createdBy: string;
}

export interface QualityCaseChanges {
  status?: QualityStatus;
  resolution?: string;
}

export interface QualityCaseRepository {
  create(data: CreateQualityCaseData): Promise<QualityCase>;
  findById(id: string): Promise<QualityCase | null>;
  listByOrder(orderId: string): Promise<QualityCase[]>;
  update(id: string, changes: QualityCaseChanges): Promise<QualityCase>;
}

export class InMemoryQualityCaseRepository implements QualityCaseRepository {
  private readonly byId = new Map<string, QualityCase>();

  async create(data: CreateQualityCaseData): Promise<QualityCase> {
    const now = new Date();
    const c: QualityCase = {
      id: randomUUID(),
      orderId: data.orderId,
      type: data.type,
      status: 'open',
      description: data.description,
      evidenceKeys: data.evidenceKeys ?? [],
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(c.id, c);
    return structuredClone(c);
  }

  async findById(id: string): Promise<QualityCase | null> {
    const c = this.byId.get(id);
    return c ? structuredClone(c) : null;
  }

  async listByOrder(orderId: string): Promise<QualityCase[]> {
    return [...this.byId.values()]
      .filter((c) => c.orderId === orderId)
      .map((c) => structuredClone(c));
  }

  async update(id: string, changes: QualityCaseChanges): Promise<QualityCase> {
    const c = this.byId.get(id);
    if (!c) throw new ConflictError('Quality case not found.');
    const updated: QualityCase = {
      ...c,
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.resolution ? { resolution: changes.resolution } : {}),
      updatedAt: new Date(),
    };
    this.byId.set(id, updated);
    return structuredClone(updated);
  }
}
