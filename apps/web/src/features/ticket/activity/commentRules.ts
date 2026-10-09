import type { KeyboardEvent } from 'react';
import { COMMENT_MAX_LENGTH } from '../fields/limits';

const count = new Intl.NumberFormat('en-US');

export const canSendComment = (text: string, fileCount: number, uploading: number): boolean =>
  (text.trim() !== '' || fileCount > 0) && uploading === 0;

export const isSubmitShortcut = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing;

// The box stops typing at the limit, but a failed comment that comes back before text typed
// meanwhile can go past it.
export const tooLongMessage = (text: string): string | null =>
  text.length > COMMENT_MAX_LENGTH
    ? `A comment can be up to ${count.format(COMMENT_MAX_LENGTH)} characters. ` +
      `This one has ${count.format(text.length)}: shorten it to send it.`
    : null;
