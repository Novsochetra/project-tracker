import {
  MAX_ATTACHMENT_BYTES,
  UNSUPPORTED_ATTACHMENT_MESSAGE,
  type Attachment,
  type ErrorBody,
  type Ticket,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { PENDING_TTL_MS, removeStalePendingAttachments } from '../../src/services/attachments';
import { fileForm, imageForm, pngBytes } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

const MB = 1024 * 1024;

const NOT_FOUND = { error: { code: 'not_found', message: 'Attachment was not found.' } };

describe.each(DIALECTS)('attachments (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let ticket: Ticket;

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app' });
    ticket = await api.client().createTicket('MA', { title: 'Crash' });
    api.events.length = 0;
  });

  const upload = (form: FormData) => api.post<Attachment>('/api/attachments', form);

  const storedExtensions = () => [...api.storage.files.keys()].map((key) => key.split('.').pop());

  it('stores a pending image with its size and dimensions', async () => {
    const bytes = pngBytes(4, 7);
    const res = await upload(imageForm({ bytes, name: 'shot.png' }));
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

  it('links an upload with a ticket key to that ticket right away', async () => {
    const res = await upload(imageForm({ ticketKey: ' ma-1 ' }));
    expect(res.body.ticketId).toBe(ticket.id);
    const detail = await api.client().getTicket(ticket.key);
    expect(detail.attachments.map((a) => a.id)).toEqual([res.body.id]);
    expect(detail.ticket.updatedAt).toBeGreaterThan(ticket.updatedAt);
    expect(api.events).toEqual([
      { type: 'changed', projectId: ticket.projectId, ticketId: ticket.id },
    ]);
    const missing = await upload(imageForm({ ticketKey: 'MA-9' }));
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
    const { body } = await upload(imageForm({ bytes }));
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
    const { body } = await upload(fileForm({ name: 'notes.txt' }));
    api.storage.files.clear();
    const res = await api.get(body.url, { headers: { range: 'bytes=0-1' } });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  it('deletes the row and the file', async () => {
    const { body } = await upload(imageForm({ ticketKey: ticket.key }));
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
      const res = await upload(fileForm({ name, type }));
      expect(res.status, name).toBe(201);
      expect(res.body, name).toMatchObject({ fileName: name, mimeType: type, size: 5 });
    }
    expect(storedExtensions()).toEqual(files.map(([, , extension]) => extension));
  });

  it('keeps dimensions for images only', async () => {
    const video = await upload(
      fileForm({ bytes: pngBytes(), name: 'clip.mp4', type: 'video/mp4' }),
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
      const res = await upload(fileForm({ name, type }));
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
      const res = await upload(fileForm({ name, type }));
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
      const res = await upload(fileForm({ name, type }));
      expect(res.status, name).toBe(400);
      expect(res.body, name).toEqual({
        error: { code: 'invalid_input', message: UNSUPPORTED_ATTACHMENT_MESSAGE },
      });
    }
    expect(api.storage.files.size).toBe(0);
  });

  it('needs a multipart file field', async () => {
    const empty = await api.post<ErrorBody>('/api/attachments', new FormData());
    expect(empty.status).toBe(400);
    expect(empty.body.error.message).toBe('Choose a file to upload.');
    const json = await api.post<ErrorBody>('/api/attachments', { file: 'x' });
    expect(json.status).toBe(400);
    const broken = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=xyz' },
      body: 'not really multipart',
    });
    expect(broken.status).toBe(400);
    expect(await broken.json()).toEqual({
      error: { code: 'invalid_input', message: 'Send the file as multipart form data.' },
    });
  });

  it('keeps dimensions empty when the image cannot be read', async () => {
    const res = await upload(imageForm({ bytes: new Uint8Array([1, 2, 3]) }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ width: null, height: null, size: 3 });
  });

  it('applies the size limit of each kind', async () => {
    const sixteenMb = new Uint8Array(16 * MB);
    const image = await upload(imageForm({ bytes: sixteenMb }));
    expect(image.status).toBe(400);
    expect(image.body).toEqual({
      error: { code: 'invalid_input', message: 'Images can be up to 15 MB.' },
    });
    const video = await upload(fileForm({ bytes: sixteenMb, name: 'clip.mp4', type: 'video/mp4' }));
    expect(video.status).toBe(201);
    expect(video.body.size).toBe(16 * MB);
    const log = await upload(fileForm({ bytes: new Uint8Array(5 * MB + 1), name: 'big.log' }));
    expect(log.body).toEqual({
      error: { code: 'invalid_input', message: 'Text files can be up to 5 MB.' },
    });
    expect(storedExtensions()).toEqual(['mp4']);
  });

  it('refuses a body larger than the largest kind allows before reading it', async () => {
    const res = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=xyz',
        'content-length': String(MAX_ATTACHMENT_BYTES + 128 * 1024),
      },
      body: 'x',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: 'invalid_input', message: 'Files can be up to 100 MB.' },
    });
  });

  it('links pending uploads of any kind to a ticket created with their ids', async () => {
    const video = (await upload(fileForm({ name: 'repro.mov', type: 'video/quicktime' }))).body;
    const log = (await upload(fileForm({ name: 'crash.log', type: '' }))).body;
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
    const named = await upload(fileForm({ name: 'ការងារ 📄.txt' }));
    expect(named.body.fileName).toBe('ការងារ 📄.txt');
    // FormData leaves out an empty file name, so this part is written by hand.
    const unnamed = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
      body:
        '--b\r\nContent-Disposition: form-data; name="file"; filename="  "\r\n' +
        'Content-Type: application/pdf\r\n\r\n%PDF\r\n--b--\r\n',
    });
    expect(unnamed.status).toBe(201);
    expect(((await unnamed.json()) as Attachment).fileName).toBe('attachment.pdf');
  });

  it('cuts long names to 200 characters without splitting one', async () => {
    const res = await upload(fileForm({ name: `${'a'.repeat(199)}📄.txt` }));
    expect(res.body.fileName).toBe(`${'a'.repeat(199)}📄`);
    expect((await api.app.request(res.body.url)).status).toBe(200);
  });

  it('removes pending uploads older than a day at startup, and only those', async () => {
    const stale = (await upload(imageForm())).body;
    const linked = (await upload(imageForm({ ticketKey: ticket.key }))).body;
    const now = Date.now() + PENDING_TTL_MS + 60_000;
    const fresh = (await upload(imageForm())).body;
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
