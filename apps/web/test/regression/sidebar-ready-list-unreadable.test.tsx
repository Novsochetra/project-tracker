import { act, render, screen, waitFor, within } from '@testing-library/react';
import type { ProjectSummary } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../src/api';
import { fakeClient } from '../../src/api/test/fakeClient';
import { listItem, otherProject, STATUS, statuses } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { projectSummary } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// Reviewer 44 (PT-71): the desktop sidebar reads the ready list for its "2 ready" counts, but its
// error boundary only tried again when the projects answer changed. A ready list it couldn't read
// ({ tickets: null }) kept "Couldn't show the projects" until a reload, even after good answers.

vi.mock('../../src/features/project/ProjectScreen', async () => {
  const { createElement } = await import('react');
  return { ProjectScreen: () => createElement('p', null, 'Project screen') };
});

const PROJECTS: ProjectSummary[] = [
  projectSummary({ openCount: 3 }),
  projectSummary({ ...otherProject, openCount: 0 }),
];
const READY = {
  tickets: [listItem(4, STATUS.reviewed, 0, { lastReview: { verdict: 'approved', rating: 4 } })],
  statuses,
};

let restore: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  restore = [skipAnimations(), mockPhone(false)];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  restore.forEach((undo) => undo());
  consoleError.mockRestore();
  window.history.replaceState(null, '', '/');
});

const sidebar = () => screen.getByRole('complementary', { name: 'Projects' });

describe('regression: the desktop sidebar with a ready list it cannot read', () => {
  it('keeps the projects, leaves out the ready counts, and shows them once the list is fixed', async () => {
    let ready: unknown = { tickets: null, statuses };
    const queryClient = createTestQueryClient();
    window.history.replaceState(null, '', '/p/MOB');
    render(
      <TrackerApp
        client={fakeClient({
          getSession: () => Promise.resolve({ authRequired: false, authenticated: true }),
          listProjects: () => Promise.resolve(PROJECTS),
          listAllTickets: () => Promise.resolve(ready),
          getBoard: () => new Promise(() => undefined),
        })}
        queryClient={queryClient}
      />,
    );
    await screen.findByText('Project screen');
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    const mobile = within(sidebar()).getByRole('button', { name: /^Mobile app/ });
    expect(mobile).toHaveAttribute('aria-current', 'page');
    expect(within(sidebar()).getByRole('button', { name: /^Website/ })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't show the projects")).toBeNull();
    expect(within(sidebar()).queryByText(/ready/)).toBeNull();

    ready = READY;
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.ready() }));
    expect(await within(sidebar()).findByText('1 ready')).toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: /^Mobile app/ })).toHaveTextContent(
      'Mobile app 1 ready 2 open',
    );
  });
});
