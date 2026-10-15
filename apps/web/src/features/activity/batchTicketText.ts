import { parseTicketKey } from '@tracker/shared';
import type { Route } from '../../navigation';

export const ticketRoute = (projectKey: string, ticketKey: string): Route => ({
  name: 'ticket',
  key: projectKey,
  num: parseTicketKey(ticketKey)?.num ?? 0,
});

export const ticketsLabel = (projectName: string): string => `Run all tickets in ${projectName}`;

export const openProjectText = (projectName: string): string => `Open ${projectName}`;
