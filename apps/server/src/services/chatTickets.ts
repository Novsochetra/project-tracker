import { ticketCards, type Actor, type cardTicketInput, type ChatDetail } from '@tracker/shared';
import type { z } from 'zod';
import type { UserScope } from '../auth/scope';
import { notFound } from '../errors';
import { linkCardTicket } from '../repositories/chatCardTickets';
import { findMessage } from '../repositories/chats';
import { getChat, requireChat } from './chats';
import { forUser, type ServiceContext } from './context';
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

// The first card keeps the message id, the client id it had when a message held one card.
const cardClientId = (messageId: string, index: number): string =>
  index === 0 ? messageId : `${messageId}:${index}`;

// Each card has its own client id, so a second tap on Create or Create all gets the same ticket.
export async function createCardTicket(
  ctx: ServiceContext,
  { scope, actor }: Person,
  ref: CardRef,
  { index, ...fields }: CardValues,
): Promise<ChatDetail> {
  const chat = await requireChat(ctx, scope, ref.chatId);
  const message = await findMessage(ctx.db, chat.id, ref.messageId);
  if (message?.role !== 'claude') throw notFound('That answer was not found.');
  if (index >= ticketCards(message.text).length) throw notFound('That card was not found.');
  const ticket = await createTicket(forUser(ctx, scope), actor, chat.projectKey, {
    ...fields,
    assignee: '',
    due: '',
    attachmentIds: [],
    clientId: cardClientId(message.id, index),
  });
  await linkCardTicket(ctx.db, { messageId: message.id, cardIndex: index, ticketId: ticket.id });
  return getChat(ctx, scope, chat.id);
}
