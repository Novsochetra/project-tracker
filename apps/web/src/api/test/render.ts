import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import type { ProjectBoard, TicketDetail, TicketListItem } from '@tracker/shared';
import { createElement, type ReactNode } from 'react';
import { ApiProvider } from '../ApiProvider';
import { createQueryClient } from '../queryClient';
import { queryKeys } from '../queryKeys';
import { fakeClient } from './fakeClient';
import { makeBoard, makeTicketDetail } from './fixtures';

export function createTestQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retry: false } });
  return queryClient;
}

export function apiWrapper(client: TrackerClient, queryClient: QueryClient) {
  return function TestApiProvider({ children }: { children: ReactNode }) {
    return createElement(ApiProvider, { client, queryClient, children });
  };
}

export function setupApi(overrides: Parameters<typeof fakeClient>[0] = {}) {
  const client = fakeClient(overrides);
  const queryClient = createTestQueryClient();
  return { client, queryClient, wrapper: apiWrapper(client, queryClient) };
}

export function seedTicket(queryClient: QueryClient, detail: TicketDetail = makeTicketDetail()) {
  queryClient.setQueryData(queryKeys.board(detail.project.key), makeBoard());
  queryClient.setQueryData(queryKeys.ticket(detail.ticket.key), detail);
}

export const isInvalidated = (queryClient: QueryClient, queryKey: QueryKey): boolean =>
  queryClient.getQueryState(queryKey)?.isInvalidated ?? false;

export const cachedBoard = (queryClient: QueryClient, projectKey = 'MOB'): ProjectBoard => {
  const board = queryClient.getQueryData<ProjectBoard>(queryKeys.board(projectKey));
  if (!board) throw new Error(`No cached board for ${projectKey}.`);
  return board;
};

export const boardTicket = (queryClient: QueryClient, ticketKey: string): TicketListItem => {
  const ticket = cachedBoard(queryClient).tickets.find((item) => item.key === ticketKey);
  if (!ticket) throw new Error(`${ticketKey} is not on the cached board.`);
  return ticket;
};

export const cachedTicket = (queryClient: QueryClient, ticketKey = 'MOB-1'): TicketDetail => {
  const detail = queryClient.getQueryData<TicketDetail>(queryKeys.ticket(ticketKey));
  if (!detail) throw new Error(`No cached detail for ${ticketKey}.`);
  return detail;
};
