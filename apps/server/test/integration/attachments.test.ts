import {
  MAX_ATTACHMENT_BYTES,
  type Attachment,
  type ErrorBody,
  type Ticket,
} from '@tracker/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { PENDING_TTL_MS, removeStalePendingAttachments } from '../../src/services/attachments';
import { imageForm, pngBytes } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

describe.each(DIALECTS)('attachments (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let ticket: Ticket;

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app' });
    ticket = await api.client().createTicket('MA', { title: 'Crash' });
    api.events.length = 0;
  });

  const upload = (form: FormData) => api.post<Attachment>('/api/attachments', form);

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
    expect((await api.get('/api/attachments/missing/file')).status).toBe(404);
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
    expect((await api.delete(`/api/attachments/${body.id}`)).status).toBe(404);
    expect((await api.get(body.url)).status).toBe(404);
  });

  it('accepts only images', async () => {
    for (const type of ['text/plain', 'image/svg+xml', 'application/pdf']) {
      const res = await upload(imageForm({ type }));
      expect(res.status, type).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'invalid_input' } });
    }
    for (const type of ['image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif']) {
      expect((await upload(imageForm({ type }))).status, type).toBe(201);
    }
    expect(api.storage.files.size).toBe(5);
  });

  it('needs a multipart file field', async () => {
    const empty = await api.post<ErrorBody>('/api/attachments', new FormData());
    expect(empty.status).toBe(400);
    const json = await api.post<ErrorBody>('/api/attachments', { file: 'x' });
    expect(json.status).toBe(400);
    const broken = await api.app.request('/api/attachments', {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data; boundary=xyz' },
      body: 'not really multipart',
    });
    expect(broken.status).toBe(400);
  });

  it('keeps dimensions empty when the image cannot be read', async () => {
    const res = await upload(imageForm({ bytes: new Uint8Array([1, 2, 3]) }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ width: null, height: null, size: 3 });
  });

  it('rejects images over 15 MB', async () => {
    for (const size of [MAX_ATTACHMENT_BYTES + 1, MAX_ATTACHMENT_BYTES + 200_000]) {
      const res = await upload(imageForm({ bytes: new Uint8Array(size) }));
      expect(res.status, String(size)).toBe(400);
      expect(res.body).toEqual({
        error: { code: 'invalid_input', message: 'Images can be up to 15 MB.' },
      });
    }
    expect(api.storage.files.size).toBe(0);
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
