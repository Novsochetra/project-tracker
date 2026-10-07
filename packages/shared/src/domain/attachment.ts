export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export interface Attachment {
  id: string;
  ticketId: string | null;
  activityId: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: number;
}
