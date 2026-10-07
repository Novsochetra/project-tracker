import type { ContentBlock } from '@modelcontextprotocol/sdk/types.js';
import type { Attachment, TicketDetail } from '@tracker/shared';
import type { TrackerApi } from '../client';
import { describeError } from '../errors';
import { formatBytes } from '../format/text';

export const MAX_IMAGES = 4;
export const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

// Claude can only view these formats; HEIC photos from phones would make the request fail.
const VIEWABLE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export function ticketImages(detail: TicketDetail): Attachment[] {
  const candidates = [
    ...detail.attachments.filter((image) => image.activityId === null),
    ...[...detail.activity]
      .sort((a, b) => a.createdAt - b.createdAt)
      .flatMap((item) => item.attachments),
    ...detail.attachments,
  ];
  const seen = new Set<string>();
  return candidates.filter((image) => {
    if (seen.has(image.id) || !image.mimeType.startsWith('image/')) return false;
    seen.add(image.id);
    return true;
  });
}

const note = (text: string): ContentBlock => ({ type: 'text', text });

const tooLarge = (image: Attachment, bytes: number): ContentBlock =>
  note(
    `Image ${image.fileName} not shown: ${formatBytes(bytes)} is over the ${formatBytes(MAX_IMAGE_BYTES)} limit.`,
  );

async function imageBlock(client: TrackerApi, image: Attachment): Promise<ContentBlock[]> {
  if (!VIEWABLE_TYPES.has(image.mimeType)) {
    return [
      note(`Image ${image.fileName} not shown: ${image.mimeType} images can't be displayed.`),
    ];
  }
  if (image.size > MAX_IMAGE_BYTES) return [tooLarge(image, image.size)];
  try {
    const response = await client.fetchAttachment(image.id);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) return [tooLarge(image, bytes.byteLength)];
    // The label lets the model match each image to the file names in the ticket text.
    return [
      note(`Image ${image.fileName}:`),
      { type: 'image', data: bytes.toString('base64'), mimeType: image.mimeType },
    ];
  } catch (error) {
    return [note(`Image ${image.fileName} could not be loaded: ${describeError(error)}`)];
  }
}

export async function imageContent(
  client: TrackerApi,
  images: readonly Attachment[],
): Promise<ContentBlock[]> {
  const shown = images.slice(0, MAX_IMAGES);
  const blocks = (await Promise.all(shown.map((image) => imageBlock(client, image)))).flat();
  const hidden = images.length - shown.length;
  if (hidden > 0) {
    blocks.push(note(`${hidden} more image${hidden === 1 ? '' : 's'} not shown.`));
  }
  return blocks;
}
