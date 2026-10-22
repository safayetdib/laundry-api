import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors';
import type { AuditRepository } from '../audit/audit.repository';
import type { Role } from '../users/user.types';
import { makeStop, type ManifestRepository } from './manifest.repository';
import type { RouteManifest, RouteStopType } from './manifest.types';

export interface ManifestActor {
  id: string;
  roles: Role[];
}

export interface ManifestServiceDeps {
  manifests: ManifestRepository;
  audit: AuditRepository;
}

const STAFF: Role[] = ['admin', 'operations'];

function requireStaff(actor: ManifestActor): void {
  if (!actor.roles.some((r) => STAFF.includes(r))) {
    throw new ForbiddenError('Only operations staff can manage route manifests.');
  }
}

export interface StopInput {
  type: RouteStopType;
  orderId?: string;
  deliveryTaskId?: string;
}

export class ManifestService {
  constructor(private readonly deps: ManifestServiceDeps) {}

  async createManifest(
    input: { date: string; notes?: string; vehicleCapacity?: number },
    actor: ManifestActor,
  ): Promise<RouteManifest> {
    requireStaff(actor);
    const manifest = await this.deps.manifests.create(input);
    await this.deps.audit.record({
      actor: actor.id,
      action: 'manifest.created',
      resourceType: 'RouteManifest',
      resourceId: manifest.id,
      summary: { date: input.date },
    });
    return manifest;
  }

  /** Operator sets the ordered stops (only while the manifest is a draft). */
  async setStops(
    manifestId: string,
    stops: StopInput[],
    actor: ManifestActor,
  ): Promise<RouteManifest> {
    requireStaff(actor);
    const manifest = await this.deps.manifests.findById(manifestId);
    if (!manifest) throw new NotFoundError('Manifest not found.');
    if (manifest.status !== 'draft') {
      throw new ConflictError('Stops can only be arranged while the manifest is a draft.');
    }
    const ordered = stops.map((s, index) => makeStop(s, index + 1));
    return this.deps.manifests.update(manifestId, manifest.version, { stops: ordered });
  }

  async assignRider(
    manifestId: string,
    riderId: string,
    actor: ManifestActor,
  ): Promise<RouteManifest> {
    requireStaff(actor);
    const manifest = await this.deps.manifests.findById(manifestId);
    if (!manifest) throw new NotFoundError('Manifest not found.');
    if (manifest.status !== 'draft') {
      throw new ConflictError('Only a draft manifest can be assigned.');
    }
    const updated = await this.deps.manifests.update(manifestId, manifest.version, {
      riderId,
      status: 'assigned',
    });
    await this.deps.audit.record({
      actor: actor.id,
      action: 'manifest.assigned',
      resourceType: 'RouteManifest',
      resourceId: manifestId,
      summary: { riderId },
    });
    return updated;
  }

  async listForRider(riderId: string): Promise<RouteManifest[]> {
    return this.deps.manifests.listByRider(riderId);
  }
}
