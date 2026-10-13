import { describe, expect, it } from 'vitest';
import {
  chatBackLabel,
  chatIntro,
  chatRoute,
  newTicketChatRoute,
  startInputOf,
  ticketNumOf,
  ticketRoute,
} from './ticketChat';

const input = { runnerId: 'r-1', text: 'Why?' };

describe('ticketNumOf', () => {
  it('reads the ticket of a chat opened from one, and none elsewhere', () => {
    expect(ticketNumOf({ name: 'chat', key: 'MOB', chatId: null, ticketNum: 3 })).toBe(3);
    expect(ticketNumOf({ name: 'chat', key: 'MOB', chatId: null })).toBeUndefined();
    expect(ticketNumOf({ name: 'ticket', key: 'MOB', num: 3 })).toBeUndefined();
    expect(ticketNumOf(undefined)).toBeUndefined();
  });
});

describe('startInputOf', () => {
  it('names the ticket for a chat about one', () => {
    expect(startInputOf(input, 'MOB', 3)).toEqual({ ...input, ticketKey: 'MOB-3' });
  });

  it('sends the question alone otherwise', () => {
    expect(startInputOf(input, 'MOB', undefined)).toEqual(input);
  });
});

describe('chatRoute', () => {
  it('keeps the ticket, so Back returns to it', () => {
    expect(chatRoute('MOB', 'c-1', 3)).toEqual({
      name: 'chat',
      key: 'MOB',
      chatId: 'c-1',
      ticketNum: 3,
    });
    expect(chatRoute('MOB', 'c-1', undefined)).toEqual({ name: 'chat', key: 'MOB', chatId: 'c-1' });
  });
});

describe('ticket routes from a key', () => {
  it('opens the ticket, or a new chat under it', () => {
    expect(ticketRoute('mob-3')).toEqual({ name: 'ticket', key: 'MOB', num: 3 });
    expect(newTicketChatRoute('MOB-3')).toEqual({
      name: 'chat',
      key: 'MOB',
      chatId: null,
      ticketNum: 3,
    });
  });

  it('opens nothing for a key that is not one', () => {
    expect(ticketRoute('MOB')).toBeNull();
    expect(newTicketChatRoute('MOB-0')).toBeNull();
  });
});

describe('the chat screen opened from a ticket', () => {
  it('goes back to the ticket and says what Claude sees of it', () => {
    expect(chatBackLabel('MOB', 3)).toBe('MOB-3');
    expect(chatIntro(3)).toContain('about this ticket');
  });

  it('goes back to the chat list otherwise', () => {
    expect(chatBackLabel('MOB', undefined)).toBe('Ask Claude');
    expect(chatIntro(undefined)).toContain('about this project');
  });
});
