import { FILE_NAME_HEADER } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import {
  deleteAttachment,
  readAttachmentFile,
  requireAttachment,
  uploadAttachment,
  type UploadInput,
} from '../../services/attachments';
import type { ServiceContext } from '../../services/context';
import { parseByteRange } from '../byteRange';
import type { AppEnv } from '../env';
import { fileHeaders } from '../fileHeaders';

function decodeName(header: string | undefined): string {
  if (!header) return '';
  try {
    return decodeURIComponent(header);
  } catch {
    return header;
  }
}

function declaredSize(header: string | undefined): number | null {
  const size = Number(header);
  return header && Number.isSafeInteger(size) && size >= 0 ? size : null;
}

// The body is the file itself and is read as it arrives (services/attachments).
function readUpload(c: Context<AppEnv>): UploadInput {
  const ticketKey = c.req.query('ticketKey')?.trim();
  return {
    body: c.req.raw.body,
    name: decodeName(c.req.header(FILE_NAME_HEADER)),
    type: c.req.header('content-type') ?? '',
    size: declaredSize(c.req.header('content-length')),
    ticketKey: ticketKey || undefined,
  };
}

async function serveFile(c: Context<AppEnv>, ctx: ServiceContext): Promise<Response> {
  const row = await requireAttachment(ctx, c.req.param('id') ?? '');
  const headers = fileHeaders(row);
  // Hono answers HEAD with this handler, and RFC 9110 defines ranges for GET only.
  const isHead = c.req.method === 'HEAD';
  const range = isHead ? null : parseByteRange(c.req.header('range'), row.size);
  if (range === 'unsatisfiable') {
    return c.body(null, 416, { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${row.size}` });
  }
  const body = await readAttachmentFile(ctx, row, range ?? undefined);
  if (isHead) {
    // Opened so a missing file fails as it does for GET, then closed: Hono would drop an unread
    // body without closing the file.
    await body.cancel();
    return c.body(null, 200, { ...headers, 'Content-Length': String(row.size) });
  }
  if (!range) return c.body(body, 200, { ...headers, 'Content-Length': String(row.size) });
  return c.body(body, 206, {
    ...headers,
    'Content-Length': String(range.end - range.start + 1),
    'Content-Range': `bytes ${range.start}-${range.end}/${row.size}`,
  });
}

export const attachmentRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/attachments', async (c) => c.json(await uploadAttachment(ctx, readUpload(c)), 201))
    .get('/attachments/:id/file', (c) => serveFile(c, ctx))
    .delete('/attachments/:id', async (c) => {
      await deleteAttachment(ctx, c.req.param('id'));
      return c.body(null, 204);
    });
