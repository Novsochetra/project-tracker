import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  ProjectSummary,
  Ticket,
  TicketListItem,
  TicketsAcrossProjects,
} from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys, useMoveTicket, useUpdateTicket } from '../../src/api';
import { fakeClient } from '../../src/api/test/fakeClient';
import { listItem, otherProject, STATUS, statuses } from '../../src/api/test/fixtures';
import { createTestQueryClient, seedTicket, setupApi } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Reviewer 57 (PT-74): the ready list shows around an entry it can't read, but the cache change
// every status move makes to it (withoutMovedTicket) read `key` on each ready ticket. With a null
// ticket or { tickets: null } cached, every move failed before its request: Done on a Ready row or
// the ticket's Status picker sent nothing and said "Can't reach the tracker".

const UNREACHABLE = /Can't reach the tracker/;

const reviewed = (num: number): TicketListItem =>
  listItem(num, STATUS.reviewed, 0, {
    title: `Reviewed ${num}`,
    lastReview: { verdict: 'approved', rating: 4 },
  });

const { commentCount: _c, attachmentCount: _a, ...moved } = listItem(1, STATUS.done, 0);
const SAVED: Ticket = moved;

const BAD_ENTRIES = [null, 'text', 7, [1, 2], {}, { key: 7 }];

const unreadable = (list: unknown) => list as TicketsAcrossProjects;

let restore: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  restore = [skipAnimations()];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  restore.forEach((undo) => undo());
  consoleError.mockRestore();
  window.history.replaceState(null, '', '/');
});

describe('regression: status moves with a ready list it cannot read', () => {
  const lists: Array<[string, TicketsAcrossProjects]> = [
    ['{ tickets: null }', unreadable({ tickets: null, statuses })],
    ['no list at all', unreadable(null)],
    ['entries it cannot read', unreadable({ tickets: [...BAD_ENTRIES, reviewed(1)], statuses })],
  ];

  it.each(lists)('sends the move and the update with %s cached', async (_, ready) => {
    const updateTicket = vi.fn().mockResolvedValue(SAVED);
    const moveTicket = vi.fn().mockResolvedValue(SAVED);
    const { queryClient, wrapper } = setupApi({ updateTicket, moveTicket });
    seedTicket(queryClient);
    queryClient.setQueryData(queryKeys.ready(), ready);
    const update = renderHook(() => useUpdateTicket(), { wrapper }).result;
    const move = renderHook(() => useMoveTicket(), { wrapper }).result;

    await act(() =>
      update.current.mutateAsync({ ticketKey: 'MOB-1', input: { statusId: STATUS.done } }),
    );
    await act(() =>
      move.current.mutateAsync({ ticketKey: 'MOB-1', input: { statusId: STATUS.done } }),
    );
    expect(updateTicket).toHaveBeenCalledWith('MOB-1', { statusId: STATUS.done });
    expect(moveTicket).toHaveBeenCalledWith('MOB-1', { statusId: STATUS.done });
  });

  it('takes the moved ticket off the list and keeps the entries it cannot read', async () => {
    const updateTicket = vi.fn(() => new Promise<Ticket>(() => undefined));
    const { queryClient, wrapper } = setupApi({ updateTicket });
    queryClient.setQueryData(
      queryKeys.ready(),
      unreadable({ tickets: [...BAD_ENTRIES, reviewed(1), reviewed(2)], statuses }),
    );
    const { result } = renderHook(() => useUpdateTicket(), { wrapper });

    act(() => result.current.mutate({ ticketKey: 'MOB-1', input: { statusId: STATUS.done } }));

    await waitFor(() => expect(updateTicket).toHaveBeenCalled());
    const list = queryClient.getQueryData<TicketsAcrossProjects>(queryKeys.ready());
    expect(list?.tickets).toEqual([...BAD_ENTRIES, reviewed(2)]);
  });
});

describe('regression: Done on a Ready row beside entries it cannot read', () => {
  it('moves the ticket to Done', async () => {
    restore.push(mockPhone(false));
    const user = userEvent.setup();
    const updateTicket = vi.fn().mockResolvedValue({ ...SAVED, id: 't-4', num: 4, key: 'MOB-4' });
    const projects: ProjectSummary[] = [
      projectSummary({ openCount: 3 }),
      projectSummary(otherProject),
    ];
    const ready = { tickets: [null, reviewed(4)], statuses: [null, ...statuses] };
    window.history.replaceState(null, '', '/');
    render(
      <TrackerApp
        client={fakeClient({
          getSession: () => Promise.resolve({ authRequired: false, authenticated: true }),
          listProjects: () => Promise.resolve(projects),
          listAllTickets: () => Promise.resolve(ready),
          updateTicket,
        })}
        queryClient={createTestQueryClient()}
      />,
    );
    const section = await screen.findByRole('region', { name: 'Ready for you' });
    await user.click(within(section).getByRole('button', { name: 'Move MOB-4 to Done' }));

    expect(updateTicket).toHaveBeenCalledWith('MOB-4', { statusId: STATUS.done });
    expect(await screen.findByText('MOB-4 moved to Done')).toBeInTheDocument();
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
  });
});

describe('regression: the Status picker with a ready list it cannot read', () => {
  it('changes the status', async () => {
    const user = userEvent.setup();
    const updateTicket = vi.fn().mockResolvedValue({ ...SAVED, statusId: STATUS.progress });
    const rendered = renderTicket({ client: { updateTicket } });
    restore.push(rendered.restorePhone);
    rendered.queryClient.setQueryData(queryKeys.ready(), unreadable({ tickets: null, statuses }));

    await user.click(screen.getByRole('button', { name: /^Status/ }));
    const list = screen.getByRole('listbox', { name: 'Status' });
    await user.click(within(list).getByRole('option', { name: 'In progress' }));

    expect(updateTicket).toHaveBeenCalledWith('MOB-1', { statusId: STATUS.progress });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Status/ })).toHaveTextContent('In progress'),
    );
    expect(screen.queryByText(UNREACHABLE)).toBeNull();
  });
});
