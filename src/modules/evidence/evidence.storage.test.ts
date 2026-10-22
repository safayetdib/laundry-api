import { describe, it, expect } from 'vitest';
import { S3EvidenceStorage, StubEvidenceStorage, createEvidenceStorage } from './evidence.storage';

describe('createEvidenceStorage', () => {
  it('returns the stub when S3 is not configured', () => {
    expect(createEvidenceStorage({})).toBeInstanceOf(StubEvidenceStorage);
  });

  it('returns the S3 backend when fully configured', () => {
    const storage = createEvidenceStorage({
      S3_BUCKET: 'bucket',
      S3_ACCESS_KEY_ID: 'AKIA',
      S3_SECRET_ACCESS_KEY: 'secret',
    });
    expect(storage).toBeInstanceOf(S3EvidenceStorage);
  });
});

describe('StubEvidenceStorage', () => {
  it('mints a key but no working URL', async () => {
    const target = await new StubEvidenceStorage().createUploadTarget('image/jpeg');
    expect(target.key).toMatch(/^evidence\//);
    expect(target.uploadUrl).toBeNull();
  });
});

describe('S3EvidenceStorage', () => {
  it('produces a presigned upload URL (local signing, no network)', async () => {
    const storage = new S3EvidenceStorage({
      bucket: 'folded-evidence',
      region: 'us-east-1',
      accessKeyId: 'AKIAEXAMPLE',
      secretAccessKey: 'secretexample',
      ttlSeconds: 900,
    });
    const target = await storage.createUploadTarget('image/jpeg');
    expect(target.key).toMatch(/^evidence\//);
    expect(target.uploadUrl).toContain('X-Amz-Signature');
    expect(target.uploadUrl).toContain('folded-evidence');
  });
});
