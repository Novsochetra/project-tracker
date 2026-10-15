import { parseTicketKey } from '@tracker/shared';
import type { Route } from '../../navigation';

export const ticketRoute = (projectKey: string, ticketKey: string): Route => {
  const num = parseTicketKey(ticketKey)?.num;
  return num ? { name: 'ticket', key: projectKey, num } : { name: 'project', key: projectKey };
};

export const ticketsLabel = (projectName: string): string => `Run all tickets in ${projectName}`;

export const openProjectText = (projectName: string): string => `Open ${projectName}`;
