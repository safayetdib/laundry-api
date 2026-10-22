import { Schema, model, type HydratedDocument } from 'mongoose';
import { ROLES, USER_STATUSES, type Role, type User, type UserStatus } from './user.types';
import type { CreateUserInput, UserRepository } from './user.repository';

interface UserDoc {
  name: string;
  phone: string;
  passwordHash: string;
  roles: Role[];
  status: UserStatus;
  partnerId?: string;
  phoneVerifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    roles: { type: [String], enum: ROLES, required: true, default: ['customer'] },
    status: { type: String, enum: USER_STATUSES, required: true, default: 'active' },
    partnerId: { type: String, index: true },
    phoneVerifiedAt: { type: Date },
  },
  { timestamps: true },
);

const UserModel = model<UserDoc>('User', userSchema);

function toUser(doc: HydratedDocument<UserDoc>): User {
  return {
    id: doc.id,
    name: doc.name,
    phone: doc.phone,
    passwordHash: doc.passwordHash,
    roles: doc.roles,
    status: doc.status,
    ...(doc.partnerId ? { partnerId: doc.partnerId } : {}),
    ...(doc.phoneVerifiedAt ? { phoneVerifiedAt: doc.phoneVerifiedAt } : {}),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export class MongoUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const doc = await UserModel.findById(id);
    return doc ? toUser(doc) : null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    const doc = await UserModel.findOne({ phone });
    return doc ? toUser(doc) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const doc = await UserModel.create(input);
      return toUser(doc);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw new Error('DUPLICATE_PHONE');
      throw err;
    }
  }
}

export { UserModel };
