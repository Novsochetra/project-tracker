import type { Actor, cardTicketInput, ChatDetail } from '@tracker/shared';
import type { z } from 'zod';
import type { UserScope } from '../auth/scope';
import { notFound } from '../errors';
import { findMessage, setMessageTicket } from '../repositories/chats';
import { getChat, requireChat } from './chats';
import type { ServiceContext } from './context';
import { createTicket } from './ticketCommands';

type CardValues = z.output<typeof cardTicketInput>;

export interface CardRef {
  chatId: string;
  messageId: string;
}

export interface Person {
  scope: UserScope;
  actor: Actor;
}

// The message id is the ticket's client id, so a second tap on Create gets the same ticket.
export async function createCardTicket(
  ctx: ServiceContext,
  { scope, actor }: Person,
  ref: CardRef,
  input: CardValues,
): Promise<ChatDetail> {
  const chat = await requireChat(ctx, scope, ref.chatId);
  const message = await findMessage(ctx.db, chat.id, ref.messageId);
  if (message?.role !== 'claude') throw notFound('That answer was not found.');
  const ticket = await createTicket(ctx, actor, chat.projectKey, {
    ...input,
    assignee: '',
    due: '',
    attachmentIds: [],
    clientId: message.id,
  });
  await setMessageTicket(ctx.db, message.id, ticket.id);
  return getChat(ctx, scope, chat.id);
}
