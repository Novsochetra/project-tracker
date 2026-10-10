import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { checkedKey, type ByteRange, type FileStorage } from './fileStorage';
import type { S3Config } from './s3Config';
import { s3Call, statusOf } from './s3Errors';

// Objects sit under one prefix, so the bucket's lifecycle rules and a migration can name them.
export const S3_KEY_PREFIX = 'attachments/';

// lib-storage holds each part in memory until S3 has it. S3's smallest part (5 MB), two at a
// time, keeps an upload near 10 MB of memory however big the file is.
const PART_BYTES = 5 * 1024 * 1024;
const PARTS_AT_ONCE = 2;

export interface S3StorageOptions {
  client: S3Client;
  bucket: string;
}

// No credentials here: the SDK reads AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY itself.
export function createS3Client({ region, endpoint }: S3Config): S3Client {
  // S3-compatible stores are reached by path (`<endpoint>/<bucket>/<key>`); AWS by the bucket's
  // own host name.
  return new S3Client({ region, ...(endpoint && { endpoint, forcePathStyle: true }) });
}

async function unlessMissing<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (statusOf(error) === 404) return null;
    throw error;
  }
}

const rangeHeader = (range: ByteRange | undefined) => range && `bytes=${range.start}-${range.end}`;

export function createS3Storage({ client, bucket }: S3StorageOptions): FileStorage {
  const target = (key: string) => ({ Bucket: bucket, Key: S3_KEY_PREFIX + checkedKey(key) });
  return {
    async write(key, body) {
      // A small file goes in one PUT, a bigger one in parts. When the body fails (too big, cut
      // off), lib-storage aborts the multipart upload, so S3 keeps no parts and no object.
      const params = { ...target(key), Body: body };
      const upload = new Upload({ client, params, partSize: PART_BYTES, queueSize: PARTS_AT_ONCE });
      await s3Call('upload', upload.done());
    },
    async read(key, range) {
      const command = new GetObjectCommand({ ...target(key), Range: rangeHeader(range) });
      const output = await s3Call('GetObject', unlessMissing(client.send(command)));
      return (output?.Body?.transformToWebStream() as ReadableStream<Uint8Array>) ?? null;
    },
    async stat(key) {
      const request = unlessMissing(client.send(new HeadObjectCommand(target(key))));
      const output = await s3Call('HeadObject', request);
      return output && { size: output.ContentLength ?? 0 };
    },
    async remove(key) {
      await s3Call('DeleteObject', client.send(new DeleteObjectCommand(target(key))));
    },
  };
}
