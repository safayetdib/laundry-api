import { randomUUID } from 'node:crypto';
import type { Role, User, UserStatus } from './user.types';

export interface CreateUserInput {
  name: string;
  phone: string;
  passwordHash: string;
  roles: Role[];
  status: UserStatus;
  partnerId?: string;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByPhone(phone: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}

/** In-memory repository for tests and local development without a database. */
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.phone === phone) return user;
    }
    return null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.findByPhone(input.phone);
    if (existing) {
      throw new Error('DUPLICATE_PHONE');
    }
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      name: input.name,
      phone: input.phone,
      passwordHash: input.passwordHash,
      roles: input.roles,
      status: input.status,
      ...(input.partnerId ? { partnerId: input.partnerId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.byId.set(user.id, user);
    return user;
  }
}
