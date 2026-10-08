import { MAX_ATTACHMENT_BYTES } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { invalidInput } from '../../errors';
import {
  TOO_LARGE_MESSAGE,
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

// Room for the multipart boundaries and the other form fields around the file.
const FORM_OVERHEAD_BYTES = 64 * 1024;

const uploadLimit = bodyLimit({
  maxSize: MAX_ATTACHMENT_BYTES + FORM_OVERHEAD_BYTES,
  onError: () => {
    throw invalidInput(TOO_LARGE_MESSAGE);
  },
});

async function readUpload(c: Context<AppEnv>): Promise<UploadInput> {
  const body = await c.req.parseBody().catch(() => {
    throw invalidInput('Send the file as multipart form data.');
  });
  const file = body.file;
  if (!(file instanceof File)) throw invalidInput('Choose a file to upload.');
  const ticketKey = typeof body.ticketKey === 'string' ? body.ticketKey.trim() : '';
  return { file, ticketKey: ticketKey || undefined };
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
    .post('/attachments', uploadLimit, async (c) =>
      c.json(await uploadAttachment(ctx, await readUpload(c)), 201),
    )
    .get('/attachments/:id/file', (c) => serveFile(c, ctx))
    .delete('/attachments/:id', async (c) => {
      await deleteAttachment(ctx, c.req.param('id'));
      return c.body(null, 204);
    });
