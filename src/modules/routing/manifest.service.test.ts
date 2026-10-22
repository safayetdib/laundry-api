import { describe, it, expect } from 'vitest';
import { ManifestService } from './manifest.service';
import { InMemoryManifestRepository } from './manifest.repository';
import { InMemoryAuditRepository } from '../audit/audit.repository';
import type { ManifestActor } from './manifest.service';

const ops: ManifestActor = { id: 'ops-1', roles: ['operations'] };
const customer: ManifestActor = { id: 'cust-1', roles: ['customer'] };

function setup() {
  return new ManifestService({
    manifests: new InMemoryManifestRepository(),
    audit: new InMemoryAuditRepository(),
  });
}

describe('ManifestService', () => {
  it('creates, orders stops, assigns a rider and lists for that rider', async () => {
    const service = setup();
    const manifest = await service.createManifest({ date: '2026-06-02' }, ops);
    expect(manifest.status).toBe('draft');

    const withStops = await service.setStops(
      manifest.id,
      [
        { type: 'delivery', orderId: 'o1' },
        { type: 'pickup', orderId: 'o2' },
      ],
      ops,
    );
    expect(withStops.stops.map((s) => s.sequence)).toEqual([1, 2]);

    const assigned = await service.assignRider(manifest.id, 'rider-1', ops);
    expect(assigned.status).toBe('assigned');
    expect(assigned.riderId).toBe('rider-1');

    const forRider = await service.listForRider('rider-1');
    expect(forRider).toHaveLength(1);
  });

  it('cannot re-arrange stops after assignment', async () => {
    const service = setup();
    const manifest = await service.createManifest({ date: '2026-06-02' }, ops);
    await service.assignRider(manifest.id, 'rider-1', ops);
    await expect(
      service.setStops(manifest.id, [{ type: 'pickup', orderId: 'o1' }], ops),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('forbids non-staff from creating a manifest', async () => {
    const service = setup();
    await expect(service.createManifest({ date: '2026-06-02' }, customer)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
