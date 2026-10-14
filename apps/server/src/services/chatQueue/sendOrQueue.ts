import type { UserScope } from '../../auth/scope';
import type { RunRow } from '../../db/runTables';
import { isHeld, listQueuedRows } from '../../repositories/chatQueue';
import { queueAsk, type AskRequest } from '../askRuns';
import type { ServiceContext } from '../context';
import { chatIsBusy, queueMessage } from './queueMessage';
import { startWaitingIn } from './startNext';

// Under the chat's lock. While Claude answers, or while messages wait for their turn, the new one
// waits behind them; the oldest starts if the chat is free. Held ones wait for Send now and
// never block a new message (PT-234).
export async function sendOrQueue(
  trx: ServiceContext,
  scope: UserScope,
  request: AskRequest,
): Promise<RunRow[]> {
  const chatId = request.chat.id;
  const busy = await chatIsBusy(trx.db, scope, chatId);
  const waiting = busy || (await listQueuedRows(trx.db, chatId)).some((row) => !isHeld(row));
  if (!waiting) return [await queueAsk(trx.db, request)];
  await queueMessage(trx.db, request);
  const started = busy ? null : await startWaitingIn(trx, scope, chatId);
  return started ? [started] : [];
}
