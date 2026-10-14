import type { Db } from '../db/schema';

// Both run on every look at a chat, so the plan test (chatRunReads) checks they use
// runs_chat_created_idx.
export const latestContextQuery = (db: Db, chatId: string) =>
  db
    .selectFrom('runs')
    .select(['runs.contextTokens', 'runs.contextWindow'])
    .where('runs.chatId', '=', chatId)
    .where('runs.contextTokens', 'is not', null)
    .where('runs.contextWindow', 'is not', null)
    .orderBy('runs.createdAt', 'desc')
    .orderBy('runs.id', 'desc')
    .limit(1);

export const chatTokensQuery = (db: Db, chatId: string) =>
  db
    .selectFrom('runs')
    .select((eb) => eb.fn.sum('runs.tokens').as('tokens'))
    .where('runs.chatId', '=', chatId);

export const latestContextRow = (db: Db, chatId: string) =>
  latestContextQuery(db, chatId).executeTakeFirst();

export const chatTokensRow = (db: Db, chatId: string) =>
  chatTokensQuery(db, chatId).executeTakeFirstOrThrow();
