import { Schema, model, type HydratedDocument } from 'mongoose';
import type { AuditLogEntry, AuditRepository, RecordAuditInput } from './audit.repository';

interface AuditDoc {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId?: string;
  summary?: Record<string, unknown>;
  createdAt: Date;
}

const auditSchema = new Schema<AuditDoc>({
  actor: { type: String, required: true, index: true },
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: { type: String, required: true },
  requestId: { type: String },
  summary: { type: Schema.Types.Mixed },
  createdAt: { type: Date, required: true, default: () => new Date(), index: true },
});
auditSchema.index({ resourceType: 1, resourceId: 1 });

const AuditModel = model<AuditDoc>('AuditLog', auditSchema);

function toEntry(doc: HydratedDocument<AuditDoc>): AuditLogEntry {
  return {
    id: doc.id,
    actor: doc.actor,
    action: doc.action,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId,
    ...(doc.requestId ? { requestId: doc.requestId } : {}),
    ...(doc.summary ? { summary: doc.summary } : {}),
    createdAt: doc.createdAt,
  };
}

export class MongoAuditRepository implements AuditRepository {
  async record(input: RecordAuditInput): Promise<AuditLogEntry> {
    const doc = await AuditModel.create(input);
    return toEntry(doc);
  }

  async listByResource(resourceType: string, resourceId: string): Promise<AuditLogEntry[]> {
    const docs = await AuditModel.find({ resourceType, resourceId }).sort({ createdAt: 1 });
    return docs.map(toEntry);
  }
}

export { AuditModel };
