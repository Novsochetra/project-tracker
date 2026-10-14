import type { ChatContext } from '@tracker/shared';
import type { Db } from '../db/schema';
import { chatTokensRow, latestContextRow } from '../repositories/chatContext';

interface ContextRow {
  contextTokens: number | null;
  contextWindow: number | null;
}

// Postgres sums a bigint as numeric, which arrives as text.
export function toChatContext(
  latest: ContextRow | undefined,
  tokens: string | number | bigint | null,
): ChatContext | undefined {
  if (!latest || latest.contextTokens === null || !latest.contextWindow) return undefined;
  return {
    used: Number(latest.contextTokens),
    window: Number(latest.contextWindow),
    tokens: tokens === null ? 0 : Number(tokens),
  };
}

// The chat's latest answer that says how full the context is; older helpers say nothing.
export async function chatContextOf(db: Db, chatId: string): Promise<ChatContext | undefined> {
  const latest = await latestContextRow(db, chatId);
  if (!latest) return undefined;
  const { tokens } = await chatTokensRow(db, chatId);
  return toChatContext(latest, tokens);
}
