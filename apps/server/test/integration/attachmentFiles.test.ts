import type { Attachment } from '@tracker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fileUpload, type FileUploadOptions } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

const BYTES = Uint8Array.from({ length: 10 }, (_, index) => index);

const IMMUTABLE = 'private, max-age=31536000, immutable';

const bytesOf = async (res: Response) => [...new Uint8Array(await res.arrayBuffer())];

describe.each(DIALECTS)('attachment files (%s)', (dialect) => {
  const api = useTestServer(dialect);
  let video: Attachment;

  const uploadFile = async (options: FileUploadOptions) =>
    (await api.upload(fileUpload(options))).body;

  const fetchFile = (url: string, headers: Record<string, string> = {}, method = 'GET') =>
    api.app.request(url, { method, headers });

  beforeEach(async () => {
    video = await uploadFile({ bytes: BYTES, name: 'clip.mp4', type: 'video/mp4' });
  });

  it('serves the whole file with its download and safety headers', async () => {
    const res = await fetchFile(video.url);
    expect(res.status).toBe(200);
    expect(Object.fromEntries(res.headers)).toMatchObject({
      'accept-ranges': 'bytes',
      'content-type': 'video/mp4',
      'content-length': '10',
      'content-disposition': `inline; filename="clip.mp4"; filename*=UTF-8''clip.mp4`,
      'cache-control': IMMUTABLE,
      'x-content-type-options': 'nosniff',
    });
    expect(res.headers.has('content-range')).toBe(false);
    expect(res.headers.has('content-security-policy')).toBe(false);
    expect(await bytesOf(res)).toEqual([...BYTES]);
  });

  it.each([
    ['bytes=0-1', 'bytes 0-1/10', { start: 0, end: 1 }],
    ['bytes=7-', 'bytes 7-9/10', { start: 7, end: 9 }],
    ['bytes=-3', 'bytes 7-9/10', { start: 7, end: 9 }],
    ['bytes=8-100', 'bytes 8-9/10', { start: 8, end: 9 }],
    ['bytes=-50', 'bytes 0-9/10', { start: 0, end: 9 }],
  ])('answers %s with 206 and reads only those bytes', async (range, contentRange, part) => {
    const read = vi.spyOn(api.storage, 'read');
    const res = await fetchFile(video.url, { range });
    expect(res.status).toBe(206);
    expect(Object.fromEntries(res.headers)).toMatchObject({
      'accept-ranges': 'bytes',
      'content-range': contentRange,
      'content-length': String(part.end - part.start + 1),
      'content-type': 'video/mp4',
      'cache-control': IMMUTABLE,
      'x-content-type-options': 'nosniff',
    });
    expect(await bytesOf(res)).toEqual([...BYTES.slice(part.start, part.end + 1)]);
    expect(read).toHaveBeenCalledWith(expect.stringMatching(/\.mp4$/), part);
    read.mockRestore();
  });

  it('answers a range outside the file with 416 and the file size', async () => {
    for (const range of ['bytes=10-', 'bytes=10-20', 'bytes=-0']) {
      const res = await fetchFile(video.url, { range });
      expect(res.status, range).toBe(416);
      expect(res.headers.get('content-range'), range).toBe('bytes */10');
      expect(res.headers.get('accept-ranges'), range).toBe('bytes');
      expect(await res.text(), range).toBe('');
    }
  });

  it('sends the whole file for a range it does not serve', async () => {
    for (const range of ['bytes=0-1,4-5', 'bytes=5-2', 'items=0-1', 'bytes=x-y']) {
      const res = await fetchFile(video.url, { range });
      expect(res.status, range).toBe(200);
      expect(res.headers.has('content-range'), range).toBe(false);
      expect(await bytesOf(res), range).toEqual([...BYTES]);
    }
  });

  it('serves part of a text file as UTF-8 in a sandbox', async () => {
    const log = await uploadFile({ bytes: new TextEncoder().encode('line one\n'), name: 's.log' });
    const res = await fetchFile(log.url, { range: 'bytes=0-3' });
    expect(res.status).toBe(206);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('content-security-policy')).toBe('sandbox');
    expect(res.headers.get('content-range')).toBe('bytes 0-3/9');
    expect(await res.text()).toBe('line');
  });

  it('sandboxes every text kind, but not PDFs, images or videos', async () => {
    const files: [string, string, string | null][] = [
      ['notes.md', 'text/markdown', 'sandbox'],
      ['export.csv', 'text/csv', 'sandbox'],
      ['config.json', 'application/json', 'sandbox'],
      ['spec.pdf', 'application/pdf', null],
      ['shot.png', 'image/png', null],
      ['clip.webm', 'video/webm', null],
    ];
    for (const [name, type, policy] of files) {
      const res = await fetchFile((await uploadFile({ name, type })).url);
      expect(res.headers.get('content-security-policy'), name).toBe(policy);
      const charset = policy ? '; charset=utf-8' : '';
      expect(res.headers.get('content-type'), name).toBe(`${type}${charset}`);
    }
  });

  it('answers HEAD with the headers of the whole file and no body', async () => {
    const variants: Record<string, string>[] = [{}, { range: 'bytes=0-1' }];
    for (const headers of variants) {
      const res = await fetchFile(video.url, headers, 'HEAD');
      expect(res.status).toBe(200);
      expect(Object.fromEntries(res.headers)).toMatchObject({
        'accept-ranges': 'bytes',
        'content-length': '10',
        'content-type': 'video/mp4',
      });
      expect(res.headers.has('content-range')).toBe(false);
      expect(await res.text()).toBe('');
    }
    expect((await fetchFile('/api/attachments/missing/file', {}, 'HEAD')).status).toBe(404);
  });

  it('keeps a non-ASCII file name for downloads', async () => {
    const name = 'ការងារ 📄.txt';
    const file = await uploadFile({ name });
    const res = await fetchFile(file.url);
    expect(res.headers.get('content-disposition')).toBe(
      `inline; filename="______ _.txt"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
  });
});
