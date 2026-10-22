import { Schema, model } from 'mongoose';
import type { SlotRepository } from './slot.repository';

interface SlotInstanceDoc {
  slotKey: string;
  capacity: number;
  reservedCount: number;
}

const slotInstanceSchema = new Schema<SlotInstanceDoc>({
  slotKey: { type: String, required: true, unique: true, index: true },
  capacity: { type: Number, required: true, min: 0 },
  reservedCount: { type: Number, required: true, default: 0, min: 0 },
});

const SlotInstanceModel = model<SlotInstanceDoc>('SlotInstance', slotInstanceSchema);

/**
 * Atomic capacity reservation backed by a per-slot counter document.
 * Reserve uses a single conditional update so concurrent bookings cannot
 * oversell a slot (loophole-review P0 #1).
 */
export class MongoSlotRepository implements SlotRepository {
  async reserve(slotKey: string, capacity: number): Promise<boolean> {
    // Ensure the counter exists without disturbing an existing reservedCount.
    await SlotInstanceModel.updateOne(
      { slotKey },
      { $setOnInsert: { slotKey, capacity, reservedCount: 0 } },
      { upsert: true },
    );

    const updated = await SlotInstanceModel.findOneAndUpdate(
      { slotKey, $expr: { $lt: ['$reservedCount', '$capacity'] } },
      { $inc: { reservedCount: 1 }, $set: { capacity } },
      { new: true },
    );
    return updated !== null;
  }

  async release(slotKey: string): Promise<void> {
    await SlotInstanceModel.updateOne(
      { slotKey, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
    );
  }

  async reservedCount(slotKey: string): Promise<number> {
    const doc = await SlotInstanceModel.findOne({ slotKey });
    return doc?.reservedCount ?? 0;
  }
}

export { SlotInstanceModel };
