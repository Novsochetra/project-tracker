import { describe, expect, it } from 'vitest';
import { openProjectText, ticketRoute, ticketsLabel } from './batchTicketText';

describe('batch tickets', () => {
  it("opens a ticket's own screen", () => {
    expect(ticketRoute('MOB', 'MOB-12')).toEqual({ name: 'ticket', key: 'MOB', num: 12 });
    expect(ticketRoute('MOB', 'not a key')).toEqual({ name: 'project', key: 'MOB' });
  });

  it('names the list and the way to the project', () => {
    expect(ticketsLabel('Mobile app')).toBe('Run all tickets in Mobile app');
    expect(openProjectText('Mobile app')).toBe('Open Mobile app');
  });
});
