export const ROUTE_STOP_TYPES = [
  'pickup',
  'delivery',
  'partner_dropoff',
  'partner_collection',
] as const;
export type RouteStopType = (typeof ROUTE_STOP_TYPES)[number];

export const ROUTE_STOP_STATUSES = [
  'pending',
  'en_route',
  'arrived',
  'completed',
  'failed',
] as const;
export type RouteStopStatus = (typeof ROUTE_STOP_STATUSES)[number];

export const MANIFEST_STATUSES = ['draft', 'assigned', 'in_progress', 'completed'] as const;
export type ManifestStatus = (typeof MANIFEST_STATUSES)[number];

export interface RouteStop {
  id: string;
  sequence: number;
  type: RouteStopType;
  orderId?: string;
  deliveryTaskId?: string;
  status: RouteStopStatus;
  failureReason?: string;
}

export interface RouteManifest {
  id: string;
  /** Service date (YYYY-MM-DD). */
  date: string;
  riderId?: string;
  status: ManifestStatus;
  notes?: string;
  /** Capacity hints for the operator; not enforced automatically in the pilot. */
  vehicleCapacity?: number;
  stops: RouteStop[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RouteManifestDTO {
  id: string;
  date: string;
  riderId?: string;
  status: ManifestStatus;
  notes?: string;
  vehicleCapacity?: number;
  stops: RouteStop[];
  version: number;
}

export function toManifestDTO(m: RouteManifest): RouteManifestDTO {
  return {
    id: m.id,
    date: m.date,
    ...(m.riderId ? { riderId: m.riderId } : {}),
    status: m.status,
    ...(m.notes ? { notes: m.notes } : {}),
    ...(m.vehicleCapacity !== undefined ? { vehicleCapacity: m.vehicleCapacity } : {}),
    stops: m.stops,
    version: m.version,
  };
}
