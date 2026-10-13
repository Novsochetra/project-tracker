import { permissionPush, questionPush, type PushPlace } from '@tracker/shared';
import type { UserScope } from '../auth/scope';
import type { RunRequestRow } from '../db/runTables';
import { findChatInScope } from '../repositories/chats';
import { findRunRequestRow } from '../repositories/runRequests';
import type { RunWithKey } from '../repositories/runs';
import { findTicketById } from '../repositories/tickets';
import type { ServiceContext } from './context';
import { pushToUser } from './push';

async function placeOfRun(
  ctx: ServiceContext,
  scope: UserScope,
  run: RunWithKey,
): Promise<PushPlace | null> {
  const { ticketId, ticketNum, chatId, projectKey } = run;
  if (ticketId && ticketNum !== null) {
    const ticket = await findTicketById(ctx.db, ticketId);
    return ticket ? { ticket: { projectKey, num: ticketNum, title: ticket.title } } : null;
  }
  const chat = chatId ? await findChatInScope(ctx.db, scope, chatId, ctx.now()) : undefined;
  return chat
    ? { chat: { projectKey: chat.projectKey, chatId: chat.id, title: chat.title } }
    : null;
}

// Read when it goes out, so a request answered or ended in between sends nothing.
export function pushRunRequest(
  ctx: ServiceContext,
  scope: UserScope,
  run: RunWithKey,
  row: RunRequestRow,
): void {
  pushToUser(ctx, scope, async () => {
    const now = await findRunRequestRow(ctx.db, row.id);
    const place = now?.status === 'open' ? await placeOfRun(ctx, scope, run) : null;
    if (!place) return null;
    return row.kind === 'question'
      ? questionPush(place, row.label)
      : permissionPush(place, row.label);
  });
}
