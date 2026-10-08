import { describe, expect, it } from 'vitest';
import { isSavedApiRead } from './apiReadRoute';
import { attachmentCachePlugin, isCachedAttachmentFile } from './attachmentFileRoute';

const ORIGIN = 'http://localhost:5173';
const FILE = '/api/attachments/f1/file';

function route(path: string, headers: Record<string, string> = {}, sameOrigin = true) {
  const request = new Request(`${ORIGIN}${path}`, { headers });
  return { url: new URL(request.url), request, sameOrigin };
}

const cached = async (response: Response) =>
  attachmentCachePlugin.cacheWillUpdate({ request: new Request(`${ORIGIN}${FILE}`), response });

describe('isCachedAttachmentFile', () => {
  it('takes whole attachment files of this origin', () => {
    expect(isCachedAttachmentFile(route(FILE))).toBe(true);
  });

  it('leaves ranged reads, as videos play, to the network', () => {
    expect(isCachedAttachmentFile(route(FILE, { range: 'bytes=0-1' }))).toBe(false);
    expect(isSavedApiRead(route(FILE, { range: 'bytes=0-' }))).toBe(false);
  });

  it('leaves other paths and origins alone', () => {
    expect(isCachedAttachmentFile(route('/api/attachments/f1'))).toBe(false);
    expect(isCachedAttachmentFile(route('/api/tickets/MOB-1'))).toBe(false);
    expect(isCachedAttachmentFile(route(FILE, {}, false))).toBe(false);
  });
});

describe('attachmentCachePlugin', () => {
  it('keeps whole images, text files and PDFs', async () => {
    for (const type of ['image/png', 'text/plain; charset=utf-8', 'application/pdf']) {
      const response = new Response('file', { headers: { 'content-type': type } });
      expect(await cached(response), type).toBe(response);
    }
  });

  it('keeps videos and partial answers out of the cache', async () => {
    const video = new Response('mp4', { headers: { 'content-type': 'video/mp4' } });
    const partial = new Response('pn', { status: 206, headers: { 'content-type': 'image/png' } });
    expect(await cached(video)).toBeNull();
    expect(await cached(partial)).toBeNull();
  });
});
