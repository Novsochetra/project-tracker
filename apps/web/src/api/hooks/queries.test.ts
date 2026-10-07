import { useQueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { TrackerClient } from '@tracker/client';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiProvider } from '../ApiProvider';
import { useApi } from '../context';
import { STALE_TIME_MS } from '../queryClient';
import { queryKeys } from '../queryKeys';
import { makeBoard, makeTicketDetail, project, statuses, summaryOf } from '../test/fixtures';
import { setupApi } from '../test/render';
import { useMeta } from './meta';
import { usePeople } from './people';
import { useBoard, useProject, useProjects } from './projects';
import { useProjectPrompt, useTicketPrompt } from './prompts';
import { useTicket } from './tickets';

describe('ApiProvider', () => {
  it('provides a same-origin client and the app query defaults when nothing is injected', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(ApiProvider, { children });
    const { result } = renderHook(() => ({ client: useApi(), queryClient: useQueryClient() }), {
      wrapper,
    });
    expect(result.current.client).toBeInstanceOf(TrackerClient);
    expect(result.current.client.eventsUrl()).toBe('/api/events');
    expect(result.current.queryClient.getDefaultOptions().queries?.staleTime).toBe(STALE_TIME_MS);
  });

  it('refuses to work outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useApi())).toThrow('useApi must be used inside <ApiProvider>.');
    vi.restoreAllMocks();
  });
});

describe('query hooks', () => {
  it('loads the project list', async () => {
    const list = [summaryOf(project)];
    const { wrapper } = setupApi({ listProjects: vi.fn().mockResolvedValue(list) });
    const { result } = renderHook(() => useProjects(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(list));
  });

  it('loads a board under the canonical key', async () => {
    const board = makeBoard();
    const getBoard = vi.fn().mockResolvedValue(board);
    const { wrapper, queryClient } = setupApi({ getBoard });
    const { result } = renderHook(() => useBoard('mob'), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(board));
    expect(getBoard).toHaveBeenCalledWith('mob');
    expect(queryClient.getQueryData(queryKeys.board('MOB'))).toEqual(board);
  });

  it('starts the project detail from a fresh cached board without fetching', () => {
    const getProject = vi.fn();
    const { wrapper, queryClient } = setupApi({ getProject });
    queryClient.setQueryData(queryKeys.board('MOB'), makeBoard());
    const { result } = renderHook(() => useProject('MOB'), { wrapper });
    expect(result.current.data).toEqual({ project, statuses });
    expect(getProject).not.toHaveBeenCalled();
  });

  it('loads a ticket, the people list and server meta', async () => {
    const detail = makeTicketDetail();
    const meta = {
      version: '1',
      repoRoot: '/r',
      mcpEntry: 'm',
      cliEntry: 'c',
      authRequired: false,
    };
    const { wrapper } = setupApi({
      getTicket: vi.fn().mockResolvedValue(detail),
      listPeople: vi.fn().mockResolvedValue(['Dara', 'Sophea']),
      getMeta: vi.fn().mockResolvedValue(meta),
    });
    const { result } = renderHook(
      () => ({ ticket: useTicket('MOB-1'), people: usePeople(), meta: useMeta() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.ticket.data).toEqual(detail));
    await waitFor(() => expect(result.current.people.data).toEqual(['Dara', 'Sophea']));
    await waitFor(() => expect(result.current.meta.data).toEqual(meta));
  });

  it('fetches prompts only while enabled', async () => {
    const getTicketPrompt = vi.fn().mockResolvedValue({ text: 'Fix it', ticketCount: 1 });
    const getProjectPrompt = vi.fn().mockResolvedValue({ text: 'All of it', ticketCount: 3 });
    const { wrapper } = setupApi({ getTicketPrompt, getProjectPrompt });
    const { result, rerender } = renderHook(
      ({ enabled }) => ({
        ticket: useTicketPrompt('MOB-1', { enabled }),
        project: useProjectPrompt('MOB', { enabled }),
      }),
      { wrapper, initialProps: { enabled: false } },
    );
    expect(getTicketPrompt).not.toHaveBeenCalled();
    expect(getProjectPrompt).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.ticket.data?.text).toBe('Fix it'));
    await waitFor(() => expect(result.current.project.data?.ticketCount).toBe(3));
  });
});
