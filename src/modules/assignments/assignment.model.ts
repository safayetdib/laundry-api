import { Schema, model, type HydratedDocument } from 'mongoose';
import { ConflictError } from '../../lib/errors';
import { ASSIGNMENT_STATUSES, type AssignmentStatus } from './assignment.status';
import type { PartnerAssignment } from './assignment.types';
import type {
  AssignmentChanges,
  AssignmentRepository,
  CreateAssignmentData,
} from './assignment.repository';

type AssignmentDoc = Omit<PartnerAssignment, 'id'>;

const itemSchema = new Schema(
  {
    orderItemId: { type: String, required: true },
    serviceCode: { type: String, required: true },
    garmentCode: { type: String },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const assignmentSchema = new Schema<AssignmentDoc>(
  {
    orderId: { type: String, required: true, index: true },
    partnerId: { type: String, required: true, index: true },
    status: { type: String, enum: ASSIGNMENT_STATUSES, required: true, index: true },
    items: { type: [itemSchema], required: true },
    payable: { type: Schema.Types.Mixed, default: null },
    intake: { type: Schema.Types.Mixed },
    version: { type: Number, required: true, default: 1 },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    receivedAt: { type: Date },
    completedAt: { type: Date },
  },
  { minimize: false },
);

const AssignmentModel = model<AssignmentDoc>('PartnerOrderAssignment', assignmentSchema);

function toAssignment(doc: HydratedDocument<AssignmentDoc>): PartnerAssignment {
  const obj = doc.toObject();
  return { id: doc.id, ...obj } as unknown as PartnerAssignment;
}

export class MongoAssignmentRepository implements AssignmentRepository {
  async create(data: CreateAssignmentData): Promise<PartnerAssignment> {
    const now = new Date();
    const doc = await AssignmentModel.create({
      ...data,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return toAssignment(doc);
  }

  async findById(id: string): Promise<PartnerAssignment | null> {
    const doc = await AssignmentModel.findById(id);
    return doc ? toAssignment(doc) : null;
  }

  async listByOrder(orderId: string): Promise<PartnerAssignment[]> {
    const docs = await AssignmentModel.find({ orderId });
    return docs.map(toAssignment);
  }

  async listByPartner(partnerId: string): Promise<PartnerAssignment[]> {
    const docs = await AssignmentModel.find({ partnerId }).sort({ createdAt: -1 });
    return docs.map(toAssignment);
  }

  async update(
    id: string,
    expectedVersion: number,
    changes: AssignmentChanges,
  ): Promise<PartnerAssignment> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    const status: AssignmentStatus | undefined = changes.status;
    if (status) set.status = status;
    if (changes.acceptedAt) set.acceptedAt = changes.acceptedAt;
    if (changes.receivedAt) set.receivedAt = changes.receivedAt;
    if (changes.completedAt) set.completedAt = changes.completedAt;
    if (changes.intake) set.intake = changes.intake;

    const doc = await AssignmentModel.findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $set: set, $inc: { version: 1 } },
      { new: true },
    );
    if (!doc) throw new ConflictError('The assignment has changed. Refresh and try again.');
    return toAssignment(doc);
  }
}

export { AssignmentModel };
