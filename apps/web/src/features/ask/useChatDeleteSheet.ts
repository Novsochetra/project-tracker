import type { Chat } from '@tracker/shared';
import { useCallback, useState } from 'react';

export interface ChatDeleteSheetState {
  chat: Chat;
  open: boolean;
}

export function useChatDeleteSheet() {
  const [sheet, setSheet] = useState<ChatDeleteSheetState | null>(null);
  const show = useCallback((chat: Chat) => setSheet({ chat, open: true }), []);
  // The chat stays while the sheet slides away, so its caption doesn't vanish mid-exit.
  const close = useCallback(
    () => setSheet((current) => current && { ...current, open: false }),
    [],
  );
  return { sheet, show, close };
}
