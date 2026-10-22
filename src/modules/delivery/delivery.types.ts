export const DELIVERY_TASK_TYPES = ['pickup', 'return_delivery'] as const;
export type DeliveryTaskType = (typeof DELIVERY_TASK_TYPES)[number];

export const DELIVERY_TASK_STATUSES = [
  'scheduled',
  'en_route',
  'arrived',
  'completed',
  'failed',
] as const;
export type DeliveryTaskStatus = (typeof DELIVERY_TASK_STATUSES)[number];

export interface DeliveryTask {
  id: string;
  orderId: string;
  type: DeliveryTaskType;
  riderId?: string;
  manifestId?: string;
  status: DeliveryTaskStatus;
  scheduledStart: string;
  scheduledEnd: string;
  attempts: number;
  failureReason?: string;
  evidenceKeys: string[];
  codAmountCollected?: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface DeliveryTaskDTO {
  id: string;
  orderId: string;
  type: DeliveryTaskType;
  riderId?: string;
  manifestId?: string;
  status: DeliveryTaskStatus;
  scheduledStart: string;
  scheduledEnd: string;
  attempts: number;
  failureReason?: string;
  codAmountCollected?: number;
  version: number;
}

export function toDeliveryTaskDTO(task: DeliveryTask): DeliveryTaskDTO {
  return {
    id: task.id,
    orderId: task.orderId,
    type: task.type,
    ...(task.riderId ? { riderId: task.riderId } : {}),
    ...(task.manifestId ? { manifestId: task.manifestId } : {}),
    status: task.status,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    attempts: task.attempts,
    ...(task.failureReason ? { failureReason: task.failureReason } : {}),
    ...(task.codAmountCollected !== undefined
      ? { codAmountCollected: task.codAmountCollected }
      : {}),
    version: task.version,
  };
}
