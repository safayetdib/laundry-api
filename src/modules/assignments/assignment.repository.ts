import { randomUUID } from 'node:crypto';
import { ConflictError } from '../../lib/errors';
import type { AssignmentStatus } from './assignment.status';
import type { AssignmentItem, AssignmentPayable, PartnerAssignment } from './assignment.types';

export interface CreateAssignmentData {
  orderId: string;
  partnerId: string;
  status: AssignmentStatus;
  items: AssignmentItem[];
  payable: AssignmentPayable | null;
}

export interface AssignmentChanges {
  status?: AssignmentStatus;
  acceptedAt?: Date;
  receivedAt?: Date;
  completedAt?: Date;
}

export interface AssignmentRepository {
  create(data: CreateAssignmentData): Promise<PartnerAssignment>;
  findById(id: string): Promise<PartnerAssignment | null>;
  listByOrder(orderId: string): Promise<PartnerAssignment[]>;
  listByPartner(partnerId: string): Promise<PartnerAssignment[]>;
  update(
    id: string,
    expectedVersion: number,
    changes: AssignmentChanges,
  ): Promise<PartnerAssignment>;
}

export class InMemoryAssignmentRepository implements AssignmentRepository {
  private readonly byId = new Map<string, PartnerAssignment>();

  async create(data: CreateAssignmentData): Promise<PartnerAssignment> {
    const now = new Date();
    const assignment: PartnerAssignment = {
      id: randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    this.byId.set(assignment.id, assignment);
    return structuredClone(assignment);
  }

  async findById(id: string): Promise<PartnerAssignment | null> {
    const a = this.byId.get(id);
    return a ? structuredClone(a) : null;
  }

  async listByOrder(orderId: string): Promise<PartnerAssignment[]> {
    return [...this.byId.values()]
      .filter((a) => a.orderId === orderId)
      .map((a) => structuredClone(a));
  }

  async listByPartner(partnerId: string): Promise<PartnerAssignment[]> {
    return [...this.byId.values()]
      .filter((a) => a.partnerId === partnerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((a) => structuredClone(a));
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: AssignmentChanges,
  ): Promise<PartnerAssignment> {
    const a = this.byId.get(id);
    if (!a) throw new ConflictError('Assignment not found.');
    if (a.version !== expectedVersion) {
      throw new ConflictError('The assignment has changed. Refresh and try again.');
    }
    const updated: PartnerAssignment = {
      ...a,
      ...(changes.status ? { status: changes.status } : {}),
      ...(changes.acceptedAt ? { acceptedAt: changes.acceptedAt } : {}),
      ...(changes.receivedAt ? { receivedAt: changes.receivedAt } : {}),
      ...(changes.completedAt ? { completedAt: changes.completedAt } : {}),
      version: a.version + 1,
      updatedAt: new Date(),
    };
    this.byId.set(id, updated);
    return structuredClone(updated);
  }
}
