import { ApiError } from '@tracker/client';
import {
  ATTACHMENT_KINDS,
  attachmentKind,
  resolveAttachmentType,
  storedExtension,
  tooLargeMessage,
} from '@tracker/shared';
import { prepareImageForUpload, type PreparedImage } from './images';

export type PreparedUpload = PreparedImage;

async function prepareImage(file: File): Promise<PreparedUpload> {
  const prepared = await prepareImageForUpload(file);
  // Scaling brings most large photos under the limit, so it is checked only now. The server
  // would refuse the rest with this answer, so they aren't sent.
  if (prepared.blob.size > ATTACHMENT_KINDS.image.maxBytes) {
    throw new ApiError(400, 'invalid_input', tooLargeMessage('image'));
  }
  return prepared;
}

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  const type = resolveAttachmentType(file.type, file.name);
  if (type && attachmentKind(type) === 'image') return prepareImage(file);
  // A form part without a file name isn't sent as a file.
  const fallback = type ? `attachment.${storedExtension(type)}` : 'attachment';
  return { blob: file, fileName: file.name || fallback };
}
