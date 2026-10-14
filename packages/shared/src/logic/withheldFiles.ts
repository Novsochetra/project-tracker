import { attachmentKind } from '../domain/attachment';
import { CHAT_ANSWER_IMAGE_TYPES } from '../domain/chat';

// The tracker strips PNG, JPEG, GIF and WebP; a HEIC or HEIF it can't decode is kept as it came,
// with where it was taken (§1.4). Claude can't view those anyway, so it never gets them (PT-233).
export const keepsLocation = (mimeType: string): boolean =>
  attachmentKind(mimeType) === 'image' && !CHAT_ANSWER_IMAGE_TYPES.includes(mimeType);

export function withheldFilesNote(names: readonly string[]): string {
  const one = names.length === 1;
  return `${names.join(', ')} ${one ? 'was' : 'were'} not passed to you: the tracker cannot remove ${one ? 'its' : 'their'} location.`;
}

export const withWithheldFiles = (prompt: string, names: readonly string[]): string =>
  names.length === 0 ? prompt : `${prompt}\n\n${withheldFilesNote(names)}`;
