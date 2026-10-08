import type { KeyboardEvent } from 'react';

export const canSendComment = (text: string, fileCount: number, uploading: number): boolean =>
  (text.trim() !== '' || fileCount > 0) && uploading === 0;

export const isSubmitShortcut = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing;
