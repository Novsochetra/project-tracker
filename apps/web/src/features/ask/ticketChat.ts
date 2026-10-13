import {
  formatTicketKey,
  parseTicketKey,
  type AskInput,
  type StartChatInput,
} from '@tracker/shared';
import { ASK_LABEL } from '../../app/crumbs';
import type { Route } from '../../navigation';
import { ASK_INTRO, ASK_TICKET_INTRO } from './copy';

// The ticket a chat screen was opened from, which a new chat is then about (PT-184).
export const ticketNumOf = (route: Route | undefined): number | undefined =>
  route?.name === 'chat' ? route.ticketNum : undefined;

export const startInputOf = (
  input: AskInput,
  projectKey: string,
  ticketNum: number | undefined,
): StartChatInput =>
  ticketNum === undefined ? input : { ...input, ticketKey: formatTicketKey(projectKey, ticketNum) };

// The new chat keeps its ticket's place in the stack, so Back still returns to the ticket.
export function chatRoute(
  projectKey: string,
  chatId: string,
  ticketNum: number | undefined,
): Route {
  const route: Route = { name: 'chat', key: projectKey, chatId };
  return ticketNum === undefined ? route : { ...route, ticketNum };
}

export function ticketRoute(ticketKey: string): Route | null {
  const parsed = parseTicketKey(ticketKey);
  return parsed ? { name: 'ticket', key: parsed.projectKey, num: parsed.num } : null;
}

export function newTicketChatRoute(ticketKey: string): Route | null {
  const parsed = parseTicketKey(ticketKey);
  return parsed && { name: 'chat', key: parsed.projectKey, chatId: null, ticketNum: parsed.num };
}

// A chat opened from a ticket goes back to it, and a new one says what Claude sees of it.
export const chatBackLabel = (projectKey: string, ticketNum: number | undefined): string =>
  ticketNum === undefined ? ASK_LABEL : formatTicketKey(projectKey, ticketNum);

export const chatIntro = (ticketNum: number | undefined): string =>
  ticketNum === undefined ? ASK_INTRO : ASK_TICKET_INTRO;
