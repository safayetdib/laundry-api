import { randomUUID } from 'node:crypto';

export interface UploadTarget {
  key: string;
  /** Presigned PUT URL; null when no storage backend is configured. */
  uploadUrl: string | null;
  note?: string;
}

/**
 * Private evidence storage. Production wires an S3-compatible backend that
 * issues short-lived presigned upload/download URLs; the API only ever
 * stores opaque keys, never public URLs (docs/08 #12).
 */
export interface EvidenceStorage {
  createUploadTarget(contentType: string): Promise<UploadTarget>;
  getDownloadUrl(key: string): Promise<string | null>;
}

/**
 * Placeholder used until object storage is configured. It mints a key so the
 * workflow can proceed in development/tests, but returns no working URL —
 * uploads are a documented open integration, not a silently-faked success.
 */
export class StubEvidenceStorage implements EvidenceStorage {
  async createUploadTarget(_contentType: string): Promise<UploadTarget> {
    return {
      key: `evidence/${randomUUID()}`,
      uploadUrl: null,
      note: 'Object storage is not configured; configure an S3-compatible backend to enable uploads.',
    };
  }

  async getDownloadUrl(_key: string): Promise<string | null> {
    return null;
  }
}
