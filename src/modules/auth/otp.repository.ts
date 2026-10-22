import { randomUUID } from 'node:crypto';

export interface OtpChallenge {
  id: string;
  phone: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date;
  createdAt: Date;
}

export interface CreateOtpInput {
  phone: string;
  codeHash: string;
  expiresAt: Date;
}

export interface OtpRepository {
  create(input: CreateOtpInput): Promise<OtpChallenge>;
  findActiveByPhone(phone: string, now: Date): Promise<OtpChallenge | null>;
  incrementAttempts(id: string): Promise<void>;
  consume(id: string): Promise<void>;
}

export class InMemoryOtpRepository implements OtpRepository {
  private readonly byId = new Map<string, OtpChallenge>();

  async create(input: CreateOtpInput): Promise<OtpChallenge> {
    const challenge: OtpChallenge = {
      id: randomUUID(),
      phone: input.phone,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      attempts: 0,
      createdAt: new Date(),
    };
    this.byId.set(challenge.id, challenge);
    return structuredClone(challenge);
  }

  async findActiveByPhone(phone: string, now: Date): Promise<OtpChallenge | null> {
    const active = [...this.byId.values()]
      .filter((c) => c.phone === phone && !c.consumedAt && c.expiresAt.getTime() > now.getTime())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return active[0] ? structuredClone(active[0]) : null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const c = this.byId.get(id);
    if (c) c.attempts += 1;
  }

  async consume(id: string): Promise<void> {
    const c = this.byId.get(id);
    if (c) c.consumedAt = new Date();
  }
}
