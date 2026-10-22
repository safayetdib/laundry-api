import { randomUUID } from 'node:crypto';

export interface AuditLogEntry {
  id: string;
  /** User id of the actor, or 'system'. */
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId?: string;
  /** Safe, non-sensitive change summary. */
  summary?: Record<string, unknown>;
  createdAt: Date;
}

export type RecordAuditInput = Omit<AuditLogEntry, 'id' | 'createdAt'>;

export interface AuditRepository {
  record(input: RecordAuditInput): Promise<AuditLogEntry>;
  listByResource(resourceType: string, resourceId: string): Promise<AuditLogEntry[]>;
}

export class InMemoryAuditRepository implements AuditRepository {
  private readonly entries: AuditLogEntry[] = [];

  async record(input: RecordAuditInput): Promise<AuditLogEntry> {
    const entry: AuditLogEntry = { ...input, id: randomUUID(), createdAt: new Date() };
    this.entries.push(entry);
    return entry;
  }

  async listByResource(resourceType: string, resourceId: string): Promise<AuditLogEntry[]> {
    return this.entries.filter(
      (entry) => entry.resourceType === resourceType && entry.resourceId === resourceId,
    );
  }
}
