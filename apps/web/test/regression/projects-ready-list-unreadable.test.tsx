import { act, render, screen, waitFor, within } from '@testing-library/react';
import type { ProjectSummary, TicketListItem } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../src/api';
import { fakeClient } from '../../src/api/test/fakeClient';
import { listItem, otherProject, STATUS, statuses } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Worker 52 (PT-55/PT-71), PT-74: the Projects screen built its ready items outside any error
// boundary, so a ready list it couldn't read ({ tickets: null }) failed the whole screen with
// "Something went wrong", and one null ticket in the list did the same.

const PROJECTS: ProjectSummary[] = [
  projectSummary({ openCount: 3 }),
  projectSummary({ ...otherProject, openCount: 0 }),
];

const reviewed = (num: number): TicketListItem =>
  listItem(num, STATUS.reviewed, 0, {
    title: `Reviewed ${num}`,
    lastReview: { verdict: 'approved', rating: 4 },
  });

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

function renderProjects(ready: unknown) {
  let current = ready;
  const queryClient = createTestQueryClient();
  window.history.replaceState(null, '', '/');
  render(
    <TrackerApp
      client={fakeClient({
        getSession: () => Promise.resolve({ authRequired: false, authenticated: true }),
        listProjects: () => Promise.resolve(PROJECTS),
        listAllTickets: () => Promise.resolve(current),
      })}
      queryClient={queryClient}
    />,
  );
  return {
    answer: async (next: unknown) => {
      current = next;
      await act(() => queryClient.refetchQueries({ queryKey: queryKeys.ready() }));
    },
  };
}

const main = () => screen.getByRole('main');
const projectRow = (name: string) =>
  within(main()).getByRole('button', { name: new RegExp(`^${name} `) });

describe.each([
  ['a phone', true],
  ['a desktop', false],
])('regression: Projects with a ready list it cannot read on %s', (_, phone) => {
  beforeEach(() => restore.push(mockPhone(phone)));

  it('keeps the projects, leaves out the ready card and counts, and shows them once fixed', async () => {
    const server = renderProjects({ tickets: null, statuses });
    expect(await within(await screen.findByRole('main')).findByText('Mobile app')).toBeVisible();
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(screen.queryByText('Something went wrong')).toBeNull();
    expect(projectRow('Mobile app')).toHaveTextContent('3 open');
    expect(projectRow('Website')).toBeInTheDocument();
    expect(within(main()).queryByText(/ready/)).toBeNull();
    expect(screen.queryByRole('region', { name: 'Ready for you' })).toBeNull();

    await server.answer({ tickets: [reviewed(4)], statuses });
    const section = await screen.findByRole('region', { name: 'Ready for you' });
    expect(within(section).getByRole('button', { name: /^MOB-4\b/ })).toBeInTheDocument();
    expect(projectRow('Mobile app')).toHaveTextContent('1 ready');
    expect(projectRow('Mobile app')).toHaveTextContent('2 open');
  });

  it('shows the ready tickets around an entry it cannot read', async () => {
    renderProjects({ tickets: [reviewed(4), null, reviewed(2)], statuses: [null, ...statuses] });
    const section = await screen.findByRole('region', { name: 'Ready for you' });
    expect(within(section).getAllByRole('button', { name: /^MOB-\d\b/ })).toHaveLength(2);
    expect(projectRow('Mobile app')).toHaveTextContent('2 ready');
    expect(projectRow('Mobile app')).toHaveTextContent('1 open');
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
