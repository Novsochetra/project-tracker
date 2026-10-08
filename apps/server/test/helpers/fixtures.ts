import { crc32, deflateSync } from 'node:zlib';
import type { Actor, ProjectDetail, Status, StatusCategory, TicketDetail } from '@tracker/shared';

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

export interface FileFormOptions {
  bytes?: Uint8Array;
  name?: string;
  type?: string;
  ticketKey?: string;
}

// An empty type reaches the server as application/octet-stream, as in browsers.
export function fileForm(options: FileFormOptions = {}): FormData {
  const form = new FormData();
  const bytes = options.bytes ?? new TextEncoder().encode('hello');
  form.set(
    'file',
    new Blob([bytes], { type: options.type ?? 'text/plain' }),
    options.name ?? 'a.txt',
  );
  if (options.ticketKey) form.set('ticketKey', options.ticketKey);
  return form;
}

export const imageForm = (options: FileFormOptions = {}): FormData =>
  fileForm({ bytes: pngBytes(), name: 'screenshot.png', type: 'image/png', ...options });

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
