import type { KeyboardEvent } from 'react';

export const canSendComment = (text: string, imageCount: number, uploading: number): boolean =>
  (text.trim() !== '' || imageCount > 0) && uploading === 0;

export const isSubmitShortcut = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing;
