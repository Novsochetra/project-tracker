import { PENDING_ATTACHMENT_TTL_MS } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { attachment } from '../../api/test/fixtures';
import { keptAttachments } from './keptAttachments';

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;
const pending = (id: string, age: number) =>
  attachment(id, { ticketId: null, createdAt: NOW - age });

describe('keptAttachments', () => {
  it('reads back the uploads a kept New ticket form holds', () => {
    const kept = [pending('a', HOUR), pending('b', 2 * HOUR)];
    expect(keptAttachments(JSON.parse(JSON.stringify(kept)), NOW)).toEqual(kept);
  });

  it('drops uploads the server may have deleted, an hour before it may', () => {
    const fresh = pending('a', PENDING_ATTACHMENT_TTL_MS - 2 * HOUR);
    const stale = pending('b', PENDING_ATTACHMENT_TTL_MS - HOUR / 2);
    expect(keptAttachments([fresh, stale], NOW)).toEqual([fresh]);
  });

  it('skips what an older build or another tab wrote that is not an upload', () => {
    const good = pending('a', HOUR);
    const { url: _url, ...noUrl } = pending('b', HOUR);
    expect(keptAttachments([good, noUrl, 'x', null, { ...good, size: '1' }], NOW)).toEqual([good]);
    expect(keptAttachments('nope', NOW)).toEqual([]);
    expect(keptAttachments(undefined, NOW)).toEqual([]);
  });
});
