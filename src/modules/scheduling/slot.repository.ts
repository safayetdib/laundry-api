export interface SlotRepository {
  /** Atomically reserves one unit if reserved < capacity. Returns false if full. */
  reserve(slotKey: string, capacity: number): Promise<boolean>;
  /** Releases one previously reserved unit (never below zero). */
  release(slotKey: string): Promise<void>;
  /** Current reserved count for a slot (0 if never reserved). */
  reservedCount(slotKey: string): Promise<number>;
}

export class InMemorySlotRepository implements SlotRepository {
  private readonly counts = new Map<string, number>();

  async reserve(slotKey: string, capacity: number): Promise<boolean> {
    const current = this.counts.get(slotKey) ?? 0;
    if (current >= capacity) return false;
    this.counts.set(slotKey, current + 1);
    return true;
  }

  async release(slotKey: string): Promise<void> {
    const current = this.counts.get(slotKey) ?? 0;
    if (current > 0) this.counts.set(slotKey, current - 1);
  }

  async reservedCount(slotKey: string): Promise<number> {
    return this.counts.get(slotKey) ?? 0;
  }
}
