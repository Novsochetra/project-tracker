import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { S3Client } from '@aws-sdk/client-s3';

// The S3 calls the tracker makes, answered from memory over HTTP, so the real SDK (signing, XML,
// lib-storage's multipart uploads and their abort) runs against it as it would against AWS.
export type S3Operation =
  | 'PutObject'
  | 'CreateMultipartUpload'
  | 'UploadPart'
  | 'CompleteMultipartUpload'
  | 'AbortMultipartUpload'
  | 'GetObject'
  | 'HeadObject'
  | 'DeleteObject';

export interface S3Call {
  operation: S3Operation;
  key: string;
  range?: string;
}

interface MultipartUpload {
  key: string;
  parts: Map<number, Buffer>;
}

export interface FakeS3 {
  bucket: string;
  endpoint: string;
  objects: Map<string, Buffer>;
  uploads: Map<string, MultipartUpload>;
  calls: S3Call[];
  // Operations answered with 403 AccessDenied, which the SDK doesn't retry.
  refused: Set<S3Operation>;
  client: () => S3Client;
  reset: () => void;
  close: () => Promise<void>;
}

interface Request {
  method: string;
  key: string;
  query: URLSearchParams;
}

function operationOf({ method, query }: Request): S3Operation | null {
  const multipart = query.has('uploadId');
  if (method === 'PUT') return multipart ? 'UploadPart' : 'PutObject';
  if (method === 'POST' && query.has('uploads')) return 'CreateMultipartUpload';
  if (method === 'POST' && multipart) return 'CompleteMultipartUpload';
  if (method === 'DELETE') return multipart ? 'AbortMultipartUpload' : 'DeleteObject';
  if (method === 'GET') return 'GetObject';
  if (method === 'HEAD') return 'HeadObject';
  return null;
}

async function bodyOf(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const xml = (res: ServerResponse, status: number, body: string) => {
  res.writeHead(status, { 'content-type': 'application/xml' });
  res.end(`<?xml version="1.0" encoding="UTF-8"?>${body}`);
};

const error = (res: ServerResponse, status: number, code: string) =>
  xml(res, status, `<Error><Code>${code}</Code><Message>${code}</Message></Error>`);

const etag = (bytes: Buffer) => `"${bytes.byteLength}-${randomUUID()}"`;

function sendObject(res: ServerResponse, bytes: Buffer, rangeHeader: string | undefined): void {
  const match = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader ?? '');
  if (!match) {
    res.writeHead(200, { 'content-length': bytes.byteLength, etag: etag(bytes) });
    res.end(bytes);
    return;
  }
  const start = Number(match[1]);
  const end = Math.min(Number(match[2]), bytes.byteLength - 1);
  res.writeHead(206, {
    'content-length': end - start + 1,
    'content-range': `bytes ${start}-${end}/${bytes.byteLength}`,
  });
  res.end(bytes.subarray(start, end + 1));
}

export async function startFakeS3(bucket = 'tracker-test'): Promise<FakeS3> {
  const objects = new Map<string, Buffer>();
  const uploads = new Map<string, MultipartUpload>();
  const calls: S3Call[] = [];
  const refused = new Set<S3Operation>();

  const handlers: Record<
    S3Operation,
    (req: IncomingMessage, res: ServerResponse, r: Request) => Promise<void> | void
  > = {
    async PutObject(req, res, { key }) {
      const bytes = await bodyOf(req);
      objects.set(key, bytes);
      res.writeHead(200, { etag: etag(bytes) }).end();
    },
    CreateMultipartUpload(_req, res, { key }) {
      const uploadId = randomUUID();
      uploads.set(uploadId, { key, parts: new Map() });
      xml(
        res,
        200,
        `<InitiateMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${key}</Key><UploadId>${uploadId}</UploadId></InitiateMultipartUploadResult>`,
      );
    },
    async UploadPart(req, res, { query }) {
      const bytes = await bodyOf(req);
      const upload = uploads.get(query.get('uploadId') ?? '');
      if (!upload) return error(res, 404, 'NoSuchUpload');
      upload.parts.set(Number(query.get('partNumber')), bytes);
      res.writeHead(200, { etag: etag(bytes) }).end();
    },
    async CompleteMultipartUpload(req, res, { key, query }) {
      const listed = [
        ...(await bodyOf(req)).toString().matchAll(/<PartNumber>(\d+)<\/PartNumber>/g),
      ];
      const uploadId = query.get('uploadId') ?? '';
      const upload = uploads.get(uploadId);
      if (!upload) return error(res, 404, 'NoSuchUpload');
      const parts = listed.map(([, number]) => upload.parts.get(Number(number)));
      if (parts.some((part) => !part)) return error(res, 400, 'InvalidPart');
      objects.set(key, Buffer.concat(parts as Buffer[]));
      uploads.delete(uploadId);
      xml(
        res,
        200,
        `<CompleteMultipartUploadResult><Bucket>${bucket}</Bucket><Key>${key}</Key><ETag>"done"</ETag></CompleteMultipartUploadResult>`,
      );
    },
    AbortMultipartUpload(_req, res, { query }) {
      uploads.delete(query.get('uploadId') ?? '');
      res.writeHead(204).end();
    },
    GetObject(req, res, { key }) {
      const bytes = objects.get(key);
      if (!bytes) return error(res, 404, 'NoSuchKey');
      sendObject(res, bytes, req.headers.range);
    },
    HeadObject(_req, res, { key }) {
      const bytes = objects.get(key);
      if (!bytes) return void res.writeHead(404).end();
      res.writeHead(200, { 'content-length': bytes.byteLength, etag: etag(bytes) }).end();
    },
    DeleteObject(_req, res, { key }) {
      objects.delete(key);
      res.writeHead(204).end();
    },
  };

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://fake-s3');
    const [, pathBucket, ...rest] = url.pathname.split('/');
    const request = {
      method: req.method ?? '',
      key: decodeURIComponent(rest.join('/')),
      query: url.searchParams,
    };
    const operation = operationOf(request);
    if (!operation || pathBucket !== bucket) return error(res, 400, 'UnexpectedRequest');
    calls.push({
      operation,
      key: request.key,
      ...(req.headers.range && { range: req.headers.range }),
    });
    if (refused.has(operation)) {
      req.resume();
      return error(res, 403, 'AccessDenied');
    }
    void Promise.resolve(handlers[operation](req, res, request)).catch((failure: unknown) => {
      res.destroy(failure as Error);
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return {
    bucket,
    endpoint,
    objects,
    uploads,
    calls,
    refused,
    client: () =>
      new S3Client({
        region: 'us-east-1',
        endpoint,
        forcePathStyle: true,
        credentials: { accessKeyId: 'fake-s3-key', secretAccessKey: 'fake-s3-secret' },
      }),
    reset() {
      objects.clear();
      uploads.clear();
      calls.length = 0;
      refused.clear();
    },
    async close() {
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
    },
  };
}
