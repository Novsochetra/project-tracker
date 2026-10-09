import type { Attachment } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { fileUpload } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// A PNG whose header claims a size no real image has, up to the 2^32 - 1 its fields allow.
function pngClaiming(width: number, height: number): Uint8Array {
  const header = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header, 0);
  header.writeUInt32BE(13, 8);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  header[24] = 8;
  header[25] = 2;
  return new Uint8Array(header);
}

// Postgres refused the claimed width (22003, out of range for integer) and the upload answered 500,
// while SQLite kept it.
describe.each(DIALECTS)('an image claiming more pixels than an integer holds (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('is kept, with its size unknown', async () => {
    await api.client().createProject({ name: 'Mobile app' });
    await api.client().createTicket('MA', { title: 'Crash' });
    const upload = await api.upload<Attachment>(
      fileUpload({
        bytes: pngClaiming(3_000_000_000, 4_294_967_295),
        name: 'odd.png',
        type: 'image/png',
        ticketKey: 'MA-1',
      }),
    );
    expect(upload.status).toBe(201);
    const [file] = (await api.client().getTicket('MA-1')).attachments;
    expect(file).toMatchObject({ id: upload.body.id, width: null, height: null });
  });
});
