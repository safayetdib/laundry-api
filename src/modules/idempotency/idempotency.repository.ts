export interface IdempotencyRecord {
  scope: string;
  key: string;
  requestHash: string;
  responseData: unknown;
  createdAt: Date;
}

export interface SaveIdempotencyInput {
  scope: string;
  key: string;
  requestHash: string;
  responseData: unknown;
}

export interface IdempotencyRepository {
  find(scope: string, key: string): Promise<IdempotencyRecord | null>;
  save(input: SaveIdempotencyInput): Promise<void>;
}

export class InMemoryIdempotencyRepository implements IdempotencyRepository {
  private readonly byKey = new Map<string, IdempotencyRecord>();

  async find(scope: string, key: string): Promise<IdempotencyRecord | null> {
    return this.byKey.get(`${scope}:${key}`) ?? null;
  }

  async save(input: SaveIdempotencyInput): Promise<void> {
    this.byKey.set(`${input.scope}:${input.key}`, { ...input, createdAt: new Date() });
  }
}
