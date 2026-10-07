import { describe, expect, it, vi } from 'vitest';
import { callTool } from '../../src/tools/call';
import { getTicket } from '../../src/tools/getTicket';
import { imageContent, MAX_IMAGE_BYTES, ticketImages } from '../../src/tools/images';
import { fakeClient, imageResponse, rejectWith, returns } from '../fakeClient';
import { activity, at, attachment, detail } from '../fixtures';

const image = (id: string, overrides = {}) =>
  attachment({ id, fileName: `${id}.png`, size: 100, ...overrides });

describe('ticketImages', () => {
  it('takes ticket images first, then comment images oldest first, without duplicates', () => {
    const inLaterComment = image('c2', { activityId: 'late' });
    const inEarlierComment = image('c1', { activityId: 'early' });
    const images = ticketImages(
      detail({
        attachments: [inLaterComment, image('t1'), inEarlierComment],
        activity: [
          activity({
            id: 'late',
            type: 'comment',
            attachments: [inLaterComment],
            createdAt: at(4, 9),
          }),
          activity({
            id: 'early',
            type: 'comment',
            attachments: [inEarlierComment],
            createdAt: at(3, 9),
          }),
        ],
      }),
    );
    expect(images.map((item) => item.id)).toEqual(['t1', 'c1', 'c2']);
  });

  it('skips attachments that are not images', () => {
    const pdf = attachment({ id: 'doc', mimeType: 'application/pdf' });
    expect(ticketImages(detail({ attachments: [pdf] }))).toEqual([]);
  });
});

describe('imageContent', () => {
  it('returns small images as labeled base64 image content', async () => {
    const fetchAttachment = vi.fn(returns(imageResponse(3)));
    const blocks = await imageContent(fakeClient({ fetchAttachment }), [image('a1')]);
    expect(fetchAttachment).toHaveBeenCalledWith('a1');
    expect(blocks).toEqual([
      { type: 'text', text: 'Image a1.png:' },
      { type: 'image', data: Buffer.from([7, 7, 7]).toString('base64'), mimeType: 'image/png' },
    ]);
  });

  it('skips images over 1.5 MB with a note, without downloading them', async () => {
    const fetchAttachment = vi.fn();
    const blocks = await imageContent(fakeClient({ fetchAttachment }), [
      image('big', { size: 2 * 1024 * 1024 }),
    ]);
    expect(fetchAttachment).not.toHaveBeenCalled();
    expect(blocks).toEqual([
      { type: 'text', text: 'Image big.png not shown: 2.0 MB is over the 1.5 MB limit.' },
    ]);
  });

  it('checks the downloaded size too', async () => {
    const client = fakeClient({ fetchAttachment: returns(imageResponse(MAX_IMAGE_BYTES + 1)) });
    const blocks = await imageContent(client, [image('liar')]);
    expect(blocks).toEqual([
      { type: 'text', text: 'Image liar.png not shown: 1.5 MB is over the 1.5 MB limit.' },
    ]);
  });

  it('does not send formats Claude cannot view', async () => {
    const fetchAttachment = vi.fn();
    const heic = image('photo', { fileName: 'IMG_1.heic', mimeType: 'image/heic' });
    const blocks = await imageContent(fakeClient({ fetchAttachment }), [heic]);
    expect(fetchAttachment).not.toHaveBeenCalled();
    expect(blocks).toEqual([
      { type: 'text', text: "Image IMG_1.heic not shown: image/heic images can't be displayed." },
    ]);
  });

  it('notes an image that fails to load instead of failing', async () => {
    const client = fakeClient({
      fetchAttachment: rejectWith(404, 'not_found', 'Attachment not found.'),
    });
    const blocks = await imageContent(client, [image('gone')]);
    expect(blocks).toEqual([
      { type: 'text', text: 'Image gone.png could not be loaded: Attachment not found.' },
    ]);
  });

  it('shows at most 4 images and says how many were left out', async () => {
    const fetchAttachment = vi.fn(() => Promise.resolve(imageResponse(1)));
    const images = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => image(id));
    const blocks = await imageContent(fakeClient({ fetchAttachment }), images);
    expect(fetchAttachment).toHaveBeenCalledTimes(4);
    expect(blocks.filter((block) => block.type === 'image')).toHaveLength(4);
    expect(blocks.at(-1)).toEqual({ type: 'text', text: '2 more images not shown.' });
  });
});

describe('get_ticket through callTool', () => {
  it('returns the text first, then the images', async () => {
    const client = fakeClient({
      getTicket: returns(detail({ attachments: [image('a1')] })),
      fetchAttachment: returns(imageResponse(2)),
    });
    const result = await callTool(getTicket, client, { ticket: 'MOB-3' });
    expect(result.isError).toBeUndefined();
    expect(result.content.map((block) => block.type)).toEqual(['text', 'text', 'image']);
  });
});
