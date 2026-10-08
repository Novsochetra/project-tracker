import {
  FILE_NAME_HEADER,
  UNSUPPORTED_ATTACHMENT_MESSAGE,
  type ErrorBody,
  type Ticket,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { PENDING_TTL_MS, removeStalePendingAttachments } from '../../src/services/attachments';
import { fileUpload, imageUpload, pngBytes, type FileUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

const MB = 1024 * 1024;

const NOT_FOUND = { error: { code: 'not_found', message: 'Attachment was not found.' } };

const invalid = (message: string) => ({ error: { code: 'invalid_input', message } });

// highWaterMark 0: a chunk is made only when the server reads one, so `pulled` is what it read.
function streamOf(bytes: number, chunkBytes = MB) {
  const counter = { pulled: 0 };
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (counter.pulled >= bytes) return controller.close();
        const size = Math.min(chunkBytes, bytes - counter.pulled);
        counter.pulled += size;
        controller.enqueue(new Uint8Array(size));
      },
    },
    { highWaterMark: 0 },
  );
  return { body, counter };
}

// The way a browser's fetch sends a stream: no Content-Length, so only reading tells the size.
const streamedUpload = (
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string>,
  path = '/api/attachments',
): FileUpload => ({ path, init: { method: 'POST', headers, body, duplex: 'half' } });

describe.each(DIALECTS)('attachments (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let ticket: Ticket;

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app' });
    ticket = await api.client().createTicket('MA', { title: 'Crash' });
    api.events.length = 0;
  });

  const upload = (file: FileUpload) => api.upload(file);

  const rowCount = async () =>
    (await api.db.selectFrom('attachments').select('id').execute()).length;

  const storedExtensions = () => [...api.storage.files.keys()].map((key) => key.split('.').pop());

  it('stores a pending image with its size and dimensions', async () => {
    const bytes = pngBytes(4, 7);
    const res = await upload(imageUpload({ bytes, name: 'shot.png' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      ticketId: null,
      activityId: null,
      fileName: 'shot.png',
      mimeType: 'image/png',
      size: bytes.byteLength,
      width: 4,
      height: 7,
      url: `/api/attachments/${res.body.id}/file`,
    });
    expect([...api.storage.files.values()]).toEqual([bytes]);
    expect(api.events).toEqual([]);
  });

  it('reads the dimensions of an image that arrives in small pieces', async () => {
    const bytes = pngBytes(640, 480);
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.byteLength) return controller.close();
        controller.enqueue(bytes.slice(offset, offset + 7));
        offset += 7;
      },
    });
    const res = await upload(
      streamedUpload(body, { 'content-type': 'image/png', [FILE_NAME_HEADER]: 'wide.png' }),
    );
    expect(res.body).toMatchObject({ width: 640, height: 480, size: bytes.byteLength });
    expect([...api.storage.files.values()]).toEqual([bytes]);
  });

  it('links an upload with a ticket key to that ticket right away', async () => {
    const res = await upload(imageUpload({ ticketKey: ' ma-1 ' }));
    expect(res.body.ticketId).toBe(ticket.id);
    const detail = await api.client().getTicket(ticket.key);
    expect(detail.attachments.map((a) => a.id)).toEqual([res.body.id]);
    expect(detail.ticket.updatedAt).toBeGreaterThan(ticket.updatedAt);
    expect(api.events).toEqual([
      { type: 'changed', projectId: ticket.projectId, ticketId: ticket.id },
    ]);
    const missing = await upload(imageUpload({ ticketKey: 'MA-9' }));
    expect(missing.status).toBe(404);
    expect(api.storage.files.size).toBe(1);
  });

  it('works through the typed client', async () => {
    const attachment = await api
      .client()
      .uploadAttachment(new Blob([pngBytes()], { type: 'image/png' }), 'a.png', ticket.key);
    expect(attachment.ticketId).toBe(ticket.id);
    const response = await api.client().fetchAttachment(attachment.id);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes());
    await api.client().deleteAttachment(attachment.id);
    expect(api.storage.files.size).toBe(0);
  });

  it('reads a text file through the typed client', async () => {
    const text = 'line one\nlíne twö 📄\n';
    const attachment = await api
      .client()
      .uploadAttachment(new Blob([text], { type: 'text/plain' }), 'notes.txt', ticket.key);
    await expect(api.client().fetchAttachmentText(attachment.id)).resolves.toBe(text);
  });

  it('serves the bytes with the content type and a long immutable cache', async () => {
    const bytes = pngBytes();
    const { body } = await upload(imageUpload({ bytes }));
    const res = await api.app.request(body.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-length')).toBe(String(bytes.byteLength));
    expect(res.headers.get('cache-control')).toContain('max-age=31536000');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
    const missing = await api.get('/api/attachments/missing/file');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual(NOT_FOUND);
  });

  it('answers 404 when the stored file is gone', async () => {
    const { body } = await upload(fileUpload({ name: 'notes.txt' }));
    api.storage.files.clear();
    const res = await api.get(body.url, { headers: { range: 'bytes=0-1' } });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it('deletes the row and the file', async () => {
    const { body } = await upload(imageUpload({ ticketKey: ticket.key }));
    api.events.length = 0;
    const res = await api.delete(`/api/attachments/${body.id}`);
    expect(res.status).toBe(204);
    expect(api.storage.files.size).toBe(0);
    expect((await api.client().getTicket(ticket.key)).attachments).toEqual([]);
    expect(api.events).toEqual([
      { type: 'changed', projectId: ticket.projectId, ticketId: ticket.id },
    ]);
    const again = await api.delete(`/api/attachments/${body.id}`);
    expect(again.status).toBe(404);
    expect(again.body).toEqual(NOT_FOUND);
    expect((await api.get(body.url)).status).toBe(404);
  });

  it('stores every allowed type under the extension of its type', async () => {
    const files = [
      ['photo.jpeg', 'image/jpeg', 'jpg'],
      ['anim.gif', 'image/gif', 'gif'],
      ['shot.webp', 'image/webp', 'webp'],
      ['IMG_0001.HEIC', 'image/heic', 'heic'],
      ['IMG_0002.heif', 'image/heif', 'heif'],
      ['clip.mp4', 'video/mp4', 'mp4'],
      ['IMG_0003.MOV', 'video/quicktime', 'mov'],
      ['screen.webm', 'video/webm', 'webm'],
      ['notes.txt', 'text/plain', 'txt'],
      ['README.md', 'text/markdown', 'md'],
      ['export.csv', 'text/csv', 'csv'],
      ['config.json', 'application/json', 'json'],
      ['spec.pdf', 'application/pdf', 'pdf'],
    ];
    for (const [name, type] of files) {
      const res = await upload(fileUpload({ name, type }));
      expect(res.status, name).toBe(201);
      expect(res.body, name).toMatchObject({ fileName: name, mimeType: type, size: 5 });
    }
    expect(storedExtensions()).toEqual(files.map(([, , extension]) => extension));
  });

  it('keeps dimensions for images only', async () => {
    const video = await upload(
      fileUpload({ bytes: pngBytes(), name: 'clip.mp4', type: 'video/mp4' }),
    );
    expect(video.body).toMatchObject({ width: null, height: null });
  });

  it('reads the type from the file name when the browser sends no useful one', async () => {
    const files = [
      ['server.log', '', 'text/plain'],
      ['README.md', 'application/octet-stream', 'text/markdown'],
      ['export.csv', 'application/vnd.ms-excel', 'text/csv'],
      ['IMG_0001.HEIC', '', 'image/heic'],
      ['IMG_0002.MOV', '', 'video/quicktime'],
    ];
    for (const [name, type, stored] of files) {
      const res = await upload(fileUpload({ name, type }));
      expect(res.status, name).toBe(201);
      expect(res.body.mimeType, name).toBe(stored);
    }
    expect(storedExtensions()).toEqual(['txt', 'md', 'csv', 'heic', 'mov']);
  });

  it('stores other names systems give an allowed type as that type', async () => {
    const files = [
      ['server.log', 'text/x-log', 'text/plain'],
      ['export.csv', 'text/x-csv', 'text/csv'],
      ['IMG_0003.JPG', 'image/jpg', 'image/jpeg'],
    ];
    for (const [name, type, stored] of files) {
      const res = await upload(fileUpload({ name, type }));
      expect(res.status, name).toBe(201);
      expect(res.body.mimeType, name).toBe(stored);
    }
    expect(storedExtensions()).toEqual(['txt', 'csv', 'jpg']);
  });

  it('refuses SVG, HTML and unknown types, saying what can be attached', async () => {
    const refused = [
      ['logo.svg', 'image/svg+xml'],
      ['logo.png', 'image/svg+xml'],
      ['page.html', 'text/html'],
      ['notes.txt', 'text/html'],
      ['page.html', ''],
      ['logs.zip', 'application/zip'],
      ['tool.exe', ''],
      ['budget.xls', 'application/vnd.ms-excel'],
    ];
    for (const [name, type] of refused) {
      const res = await upload(fileUpload({ name, type }));
      expect(res.status, name).toBe(400);
      expect(res.body, name).toEqual({
        error: { code: 'invalid_input', message: UNSUPPORTED_ATTACHMENT_MESSAGE },
      });
    }
    expect(api.storage.files.size).toBe(0);
  });

  it('asks a page still sending forms to reload', async () => {
    const form = new FormData();
    form.set('file', new Blob(['%PDF'], { type: 'application/pdf' }), 'spec.pdf');
    const res = await api.app.request('/api/attachments', { method: 'POST', body: form });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(invalid('Reload the page and add the file again.'));
    expect(api.storage.files.size).toBe(0);
  });

  it('keeps dimensions empty when the image cannot be read', async () => {
    const res = await upload(imageUpload({ bytes: new Uint8Array([1, 2, 3]) }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ width: null, height: null, size: 3 });
  });

  it('applies the size limit of each kind', async () => {
    const sixteenMb = new Uint8Array(16 * MB);
    const image = await upload(imageUpload({ bytes: sixteenMb }));
    expect(image.status).toBe(400);
    expect(image.body).toEqual({
      error: { code: 'invalid_input', message: 'Images can be up to 15 MB.' },
    });
    const video = await upload(
      fileUpload({ bytes: sixteenMb, name: 'clip.mp4', type: 'video/mp4' }),
    );
    expect(video.status).toBe(201);
    expect(video.body.size).toBe(16 * MB);
    const log = await upload(fileUpload({ bytes: new Uint8Array(5 * MB + 1), name: 'big.log' }));
    expect(log.body).toEqual({
      error: { code: 'invalid_input', message: 'Text files can be up to 5 MB.' },
    });
    expect(storedExtensions()).toEqual(['mp4']);
  });

  it('refuses a declared length over the limit of its kind before reading the body', async () => {
    const { body, counter } = streamOf(16 * MB);
    const res = await upload(
      streamedUpload(body, {
        'content-type': 'image/png',
        'content-length': String(16 * MB),
        [FILE_NAME_HEADER]: 'big.png',
      }),
    );
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalid('Images can be up to 15 MB.'));
    expect(counter.pulled).toBe(0);
  });

  it('stops reading a file sent without a length once it passes the limit of its kind', async () => {
    const { body, counter } = streamOf(200 * MB);
    const res = await upload(
      streamedUpload(body, { 'content-type': 'image/png', [FILE_NAME_HEADER]: 'big.png' }),
    );
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalid('Images can be up to 15 MB.'));
    expect(counter.pulled).toBeLessThanOrEqual(16 * MB);
    expect(api.storage.files.size).toBe(0);
    expect(await rowCount()).toBe(0);
  });

  it('takes a file sent without a length that is exactly at the limit', async () => {
    const { body } = streamOf(15 * MB);
    const res = await upload(
      streamedUpload(body, { 'content-type': 'image/png', [FILE_NAME_HEADER]: 'full.png' }),
    );
    expect(res.status).toBe(201);
    expect(res.body.size).toBe(15 * MB);
    expect([...api.storage.files.values()][0]?.byteLength).toBe(15 * MB);
  });

  it('keeps no file and no row when the upload stops before its end', async () => {
    const { body } = streamOf(3 * MB);
    const headers = {
      'content-type': 'video/mp4',
      'content-length': String(10 * MB),
      [FILE_NAME_HEADER]: 'clip.mp4',
    };
    const res = await upload(streamedUpload(body, headers, `/api/attachments?ticketKey=MA-1`));
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalid('The file did not arrive whole. Try again.'));

    const failing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MB));
        controller.error(new Error('The connection closed.'));
      },
    });
    const broken = await upload(streamedUpload(failing, headers));
    expect(broken.status).toBe(400);
    expect(broken.body).toEqual(invalid('The file did not arrive whole. Try again.'));
    expect(api.storage.files.size).toBe(0);
    expect(await rowCount()).toBe(0);
    expect(api.events).toEqual([]);
  });

  it('links pending uploads of any kind to a ticket created with their ids', async () => {
    const video = (await upload(fileUpload({ name: 'repro.mov', type: 'video/quicktime' }))).body;
    const log = (await upload(fileUpload({ name: 'crash.log', type: '' }))).body;
    expect([video.ticketId, log.ticketId]).toEqual([null, null]);
    expect(api.events).toEqual([]);

    const created = await api.client().createTicket('MA', {
      title: 'Crash on rotate',
      attachmentIds: [video.id, log.id],
    });

    const detail = await api.client().getTicket(created.key);
    expect(detail.attachments.map((file) => [file.id, file.ticketId, file.mimeType])).toEqual([
      [video.id, created.id, 'video/quicktime'],
      [log.id, created.id, 'text/plain'],
    ]);
  });

  it('says files when an attachment id cannot be linked', async () => {
    const res = await api.post<ErrorBody>('/api/projects/MA/tickets', {
      title: 'x',
      attachmentIds: ['missing'],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Some files could not be attached. Upload them again.');
  });

  it('keeps the file name, or names a file that has none', async () => {
    const named = await upload(fileUpload({ name: 'ការងារ 📄.txt' }));
    expect(named.body.fileName).toBe('ការងារ 📄.txt');
    const unnamed = await upload(fileUpload({ name: '  ', type: 'application/pdf' }));
    expect(unnamed.status).toBe(201);
    expect(unnamed.body.fileName).toBe('attachment.pdf');
    const headerless = await upload({
      path: '/api/attachments',
      init: {
        method: 'POST',
        headers: { 'content-type': 'application/pdf' },
        body: new Blob(['%PDF']),
      },
    });
    expect(headerless.body.fileName).toBe('attachment.pdf');
  });

  it('keeps a name that is not percent-encoded as it came', async () => {
    const file = fileUpload({ name: 'notes.txt' });
    const res = await upload({
      path: file.path,
      init: {
        ...file.init,
        headers: { 'content-type': 'text/plain', [FILE_NAME_HEADER]: '100%.txt' },
      },
    });
    expect(res.body.fileName).toBe('100%.txt');
  });

  it('cuts long names to 200 characters without splitting one', async () => {
    const res = await upload(fileUpload({ name: `${'a'.repeat(199)}📄.txt` }));
    expect(res.body.fileName).toBe(`${'a'.repeat(199)}📄`);
    expect((await api.app.request(res.body.url)).status).toBe(200);
  });

  it('removes pending uploads older than a day at startup, and only those', async () => {
    const stale = (await upload(imageUpload())).body;
    const linked = (await upload(imageUpload({ ticketKey: ticket.key }))).body;
    const now = Date.now() + PENDING_TTL_MS + 60_000;
    const fresh = (await upload(imageUpload())).body;
    await api.db
      .updateTable('attachments')
      .set({ createdAt: now - 1000 })
      .where('id', '=', fresh.id)
      .execute();

    expect(await removeStalePendingAttachments({ db: api.db, storage: api.storage }, now)).toBe(1);
    const ids = (await api.db.selectFrom('attachments').select('id').execute()).map(
      (row) => row.id,
    );
    expect(ids.sort()).toEqual([linked.id, fresh.id].sort());
    expect(api.storage.files.size).toBe(2);
    expect((await api.get(stale.url)).status).toBe(404);
  });
});
