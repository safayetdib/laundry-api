import { randomUUID } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
      note: 'Object storage is not configured; set S3_* env vars to enable uploads.',
    };
  }

  async getDownloadUrl(_key: string): Promise<string | null> {
    return null;
  }
}

export interface S3StorageConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Custom endpoint for S3-compatible providers (MinIO, DO Spaces, etc.). */
  endpoint?: string;
  ttlSeconds: number;
}

/**
 * Real S3-compatible storage. Presigning is a local signing operation (no
 * network), so upload/download targets are produced without contacting the
 * provider; the client uploads/downloads directly against the signed URL.
 */
export class S3EvidenceStorage implements EvidenceStorage {
  private readonly client: S3Client;

  constructor(private readonly config: S3StorageConfig) {
    this.client = new S3Client({
      region: config.region,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      ...(config.endpoint ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
    });
  }

  async createUploadTarget(contentType: string): Promise<UploadTarget> {
    const key = `evidence/${randomUUID()}`;
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, ContentType: contentType }),
      { expiresIn: this.config.ttlSeconds },
    );
    return { key, uploadUrl };
  }

  async getDownloadUrl(key: string): Promise<string | null> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      {
        expiresIn: this.config.ttlSeconds,
      },
    );
  }
}

export interface EvidenceStorageEnv {
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_ENDPOINT?: string;
  EVIDENCE_URL_TTL_SECONDS?: number;
}

/** Returns the S3 backend when fully configured, otherwise the stub. */
export function createEvidenceStorage(env: EvidenceStorageEnv): EvidenceStorage {
  if (env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    return new S3EvidenceStorage({
      bucket: env.S3_BUCKET,
      region: env.S3_REGION ?? 'us-east-1',
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
      ttlSeconds: env.EVIDENCE_URL_TTL_SECONDS ?? 900,
    });
  }
  return new StubEvidenceStorage();
}
