import { FILE_NAME_HEADER } from '@tracker/shared';
import { Hono, type Context } from 'hono';
import {
  deleteAttachment,
  readAttachmentFile,
  requireAttachment,
  requireAttachmentFile,
  uploadAttachment,
  type UploadInput,
} from '../../services/attachments';
import type { ServiceContext } from '../../services/context';
import { parseByteRange } from '../byteRange';
import type { AppEnv } from '../env';
import { fileHeaders } from '../fileHeaders';
import { personDeletesFiles } from '../personOnly';
import { userContext } from '../userContext';

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
function readUpload(context: Context<AppEnv>): UploadInput {
  const ticketKey = context.req.query('ticketKey')?.trim();

  return {
    body: context.req.raw.body,
    name: decodeName(context.req.header(FILE_NAME_HEADER)),
    type: context.req.header('content-type') ?? '',
    size: declaredSize(context.req.header('content-length')),
    ticketKey: ticketKey || undefined,
  };
}

async function serveFile(context: Context<AppEnv>, ctx: ServiceContext): Promise<Response> {
  const row = await requireAttachment(userContext(ctx, context), context.req.param('id') ?? '');
  const headers = fileHeaders(row);
  // Hono answers HEAD with this handler, and RFC 9110 defines ranges for GET only.
  if (context.req.method === 'HEAD') {
    await requireAttachmentFile(ctx, row);
    return context.body(null, 200, { ...headers, 'Content-Length': String(row.size) });
  }

  const range = parseByteRange(context.req.header('range'), row.size);
  if (range === 'unsatisfiable') {
    return context.body(null, 416, {
      'Accept-Ranges': 'bytes',
      'Content-Range': `bytes */${row.size}`,
    });
  }

  const body = await readAttachmentFile(ctx, row, range ?? undefined);
  if (!range) return context.body(body, 200, { ...headers, 'Content-Length': String(row.size) });

  return context.body(body, 206, {
    ...headers,
    'Content-Length': String(range.end - range.start + 1),
    'Content-Range': `bytes ${range.start}-${range.end}/${row.size}`,
  });
}

export const attachmentRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/attachments', async (context) =>
      context.json(await uploadAttachment(userContext(ctx, context), readUpload(context)), 201),
    )
    .get('/attachments/:id/file', (context) => serveFile(context, ctx))
    .delete('/attachments/:id', personDeletesFiles, async (context) => {
      await deleteAttachment(userContext(ctx, context), context.req.param('id'));

      return context.body(null, 204);
    });
