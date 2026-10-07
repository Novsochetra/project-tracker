import { MAX_ATTACHMENT_BYTES } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { invalidInput } from '../../errors';
import {
  TOO_LARGE_MESSAGE,
  deleteAttachment,
  openAttachment,
  uploadAttachment,
  type UploadInput,
} from '../../services/attachments';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';

// Room for the multipart boundaries and the other form fields around the file.
const FORM_OVERHEAD_BYTES = 64 * 1024;

const IMMUTABLE = 'private, max-age=31536000, immutable';

const uploadLimit = bodyLimit({
  maxSize: MAX_ATTACHMENT_BYTES + FORM_OVERHEAD_BYTES,
  onError: () => {
    throw invalidInput(TOO_LARGE_MESSAGE);
  },
});

async function readUpload(c: Context<AppEnv>): Promise<UploadInput> {
  const body = await c.req.parseBody().catch(() => {
    throw invalidInput('Send the image as multipart form data.');
  });
  const file = body.file;
  if (!(file instanceof File)) throw invalidInput('Choose an image to upload.');
  const ticketKey = typeof body.ticketKey === 'string' ? body.ticketKey.trim() : '';
  return { file, ticketKey: ticketKey || undefined };
}

export const attachmentRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/attachments', uploadLimit, async (c) =>
      c.json(await uploadAttachment(ctx, await readUpload(c)), 201),
    )
    .get('/attachments/:id/file', async (c) => {
      const { row, body } = await openAttachment(ctx, c.req.param('id'));
      return c.body(body, 200, {
        'Content-Type': row.mimeType,
        'Content-Length': String(row.size),
        'Cache-Control': IMMUTABLE,
        'X-Content-Type-Options': 'nosniff',
      });
    })
    .delete('/attachments/:id', async (c) => {
      await deleteAttachment(ctx, c.req.param('id'));
      return c.body(null, 204);
    });
