import type { Clock } from '../clock';

export interface ChatViewers {
  view: (sessionId: string, chatId: string | null) => void;
  shows: (sessionId: string | null, chatId: string | null) => boolean;
}

// The app says it again every 15 s while the chat is on screen, so a phone locked or closed before
// it could say it left gets its pushes again soon.
export const VIEWING_MS = 35_000;
// One a sign-in, so this only bounds a flood of sign-ins.
const MAX_VIEWERS = 10_000;

export function createChatViewers(now: Clock): ChatViewers {
  const viewing = new Map<string, { chatId: string; until: number }>();
  return {
    view: (sessionId, chatId) => {
      viewing.delete(sessionId);
      if (chatId === null) return;
      viewing.set(sessionId, { chatId, until: now() + VIEWING_MS });
      if (viewing.size > MAX_VIEWERS) viewing.delete(viewing.keys().next().value ?? '');
    },
    shows: (sessionId, chatId) => {
      if (sessionId === null || chatId === null) return false;
      const seen = viewing.get(sessionId);
      return seen !== undefined && seen.chatId === chatId && seen.until > now();
    },
  };
}
