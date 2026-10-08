import { attachmentKind, type Attachment } from '@tracker/shared';

export type ViewerTarget =
  | { kind: 'image'; images: Attachment[]; index: number }
  | { kind: 'video'; attachment: Attachment }
  | { kind: 'text'; attachment: Attachment }
  | { kind: 'link'; url: string };

const isImage = (attachment: Attachment): boolean =>
  attachmentKind(attachment.mimeType) === 'image';

/** Where a tapped attachment opens: images page together, PDFs open in the browser. */
export function viewerTarget(
  attachments: readonly Attachment[],
  index: number,
): ViewerTarget | null {
  const attachment = attachments[index];
  if (!attachment) return null;
  switch (attachmentKind(attachment.mimeType)) {
    case 'image': {
      const images = attachments.filter(isImage);
      return { kind: 'image', images, index: images.indexOf(attachment) };
    }
    case 'video':
      return { kind: 'video', attachment };
    case 'text':
      return { kind: 'text', attachment };
    case 'pdf':
    case null:
      return { kind: 'link', url: attachment.url };
  }
}
