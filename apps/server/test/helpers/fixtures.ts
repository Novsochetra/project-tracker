import { crc32, deflateSync } from 'node:zlib';
import {
  FILE_NAME_HEADER,
  type Actor,
  type ProjectDetail,
  type Status,
  type StatusCategory,
  type TicketDetail,
} from '@tracker/shared';

export const PERSON: Actor = { kind: 'human', name: '' };

export const agent = (name = 'Claude'): Actor => ({ kind: 'agent', name });

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

// A valid PNG, so image-size reads real dimensions from it.
export function pngBytes(width = 3, height = 2): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  const png = Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return new Uint8Array(png);
}

export interface FileUploadOptions {
  bytes?: Uint8Array;
  name?: string;
  type?: string;
  ticketKey?: string;
}

export interface FileUpload {
  path: string;
  init: RequestInit;
}

// What TrackerClient.uploadAttachment sends: the file itself as the body, its name and type in
// headers. An empty type goes as application/octet-stream, as browsers send it.
export function fileUpload(options: FileUploadOptions = {}): FileUpload {
  const bytes = options.bytes ?? new TextEncoder().encode('hello');
  const type = options.type ?? 'text/plain';
  const query = options.ticketKey ? `?ticketKey=${encodeURIComponent(options.ticketKey)}` : '';
  return {
    path: `/api/attachments${query}`,
    init: {
      method: 'POST',
      headers: {
        'content-type': type || 'application/octet-stream',
        'content-length': String(bytes.byteLength),
        [FILE_NAME_HEADER]: encodeURIComponent(options.name ?? 'a.txt'),
      },
      body: new Blob([bytes]),
    },
  };
}

export const imageUpload = (options: FileUploadOptions = {}): FileUpload =>
  fileUpload({ bytes: pngBytes(), name: 'screenshot.png', type: 'image/png', ...options });

export function statusOf(
  detail: Pick<ProjectDetail | TicketDetail, 'statuses'>,
  category: StatusCategory,
): Status {
  const status = detail.statuses.find((candidate) => candidate.category === category);
  if (!status) throw new Error(`No ${category} status`);
  return status;
}

export const eventTexts = (detail: TicketDetail): string[] =>
  detail.activity.filter((item) => item.type === 'event').map((item) => item.text);
