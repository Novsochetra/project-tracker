import { inspect } from 'node:util';
import type { Attachment } from '@tracker/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import type { Db } from '../../src/db/schema';
import { createBroadcaster } from '../../src/events/broadcaster';
import { createS3Storage } from '../../src/storage/s3Storage';
import { startFakeS3, type FakeS3 } from '../helpers/fakeS3';
import { fileUpload } from '../helpers/fixtures';
import { createTestDatabase } from '../helpers/server';

// What S3 sends back for a wrong secret: its error body names the access key and the string it
// signed. The SDK copies those onto the error, and the server logged the whole error (reviewer
// 102, PT-122).
const SIGNATURE_DETAILS =
  '<AWSAccessKeyId>AKIAFAKEKEYID12345</AWSAccessKeyId>' +
  '<StringToSign>AWS4-HMAC-SHA256 20261009T120000Z</StringToSign>' +
  '<SignatureProvided>abc123</SignatureProvided>' +
  '<CanonicalRequest>GET /tracker-test/attachments/x</CanonicalRequest>';

describe('an S3 error in the log', () => {
  let fake: FakeS3;
  let db: Db;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    fake = await startFakeS3();
    db = await createTestDatabase('sqlite');
    const storage = createS3Storage({ client: fake.client(), bucket: fake.bucket });
    app = createApp({ db, storage, events: createBroadcaster() });
  });

  afterAll(async () => {
    await db.destroy();
    await fake.close();
  });

  it('names the error, its code, status and request, and nothing of the signature', async () => {
    const { path, init } = fileUpload({ name: 'notes.txt' });
    const file = (await (await app.request(path, init)).json()) as Attachment;
    fake.refused.add('GetObject');
    Object.assign(fake.refusal, { code: 'SignatureDoesNotMatch', details: SIGNATURE_DETAILS });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await app.request(file.url);
    const text = logged.mock.calls.map((args) => args.map((arg) => inspect(arg)).join(' ')).join();
    logged.mockRestore();
    expect(res.status).toBe(500);
    expect(text).toContain('SignatureDoesNotMatch');
    expect(text).toContain('403');
    for (const secret of ['AKIAFAKEKEYID12345', 'StringToSign', 'CanonicalRequest', 'abc123']) {
      expect(text, secret).not.toContain(secret);
    }
  });
});
