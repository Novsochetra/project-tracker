import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectSummary } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { queryKeys } from '../../src/api';
import { fakeClient } from '../../src/api/test/fakeClient';
import { otherProject } from '../../src/api/test/fixtures';
import { createTestQueryClient } from '../../src/api/test/render';
import { useSheets } from '../../src/app/sheets/context';
import { SheetsProvider } from '../../src/app/sheets/SheetsProvider';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// On desktop a projects answer the sidebar couldn't read gave a white page, while the phone,
// which has no sidebar, showed the screen's own error. A sheet that failed blanked the app too.

vi.mock('../../src/features/project/ProjectScreen', async () => {
  const { createElement } = await import('react');
  return { ProjectScreen: () => createElement('p', null, 'Project screen') };
});

vi.mock('../../src/features/projects/ProjectSheet', () => ({
  ProjectSheet: () => {
    throw new Error('Project sheet crashed');
  },
}));

const PROJECTS: ProjectSummary[] = [
  projectSummary({ openCount: 3 }),
  projectSummary({ ...otherProject, openCount: 0 }),
];

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

const sidebar = () => screen.getByRole('complementary', { name: 'Projects' });

describe('regression: the desktop sidebar with a projects answer it cannot read', () => {
  it('shows a small notice in its place, keeps the app and comes back once the answer is fixed', async () => {
    restore.push(mockPhone(false));
    const user = userEvent.setup();
    let projects: unknown = [null];
    const queryClient = createTestQueryClient();
    window.history.replaceState(null, '', '/p/MOB');
    render(
      <TrackerApp
        client={fakeClient({
          getSession: () => Promise.resolve({ authRequired: false, authenticated: true }),
          listProjects: () => Promise.resolve(projects),
          getBoard: () => new Promise(() => undefined),
        })}
        queryClient={queryClient}
      />,
    );
    expect(await screen.findByText("Couldn't show the projects")).toBeInTheDocument();
    expect(within(sidebar()).getByRole('button', { name: 'All projects' })).toBeInTheDocument();
    expect(screen.getByText('Project screen')).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Sidebar couldn't be shown.",
      expect.any(TypeError),
      expect.anything(),
    );

    projects = PROJECTS;
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.projects() }));
    await waitFor(() =>
      expect(within(sidebar()).getByRole('button', { name: /^Mobile app/ })).toHaveAttribute(
        'aria-current',
        'page',
      ),
    );
    expect(screen.queryByText("Couldn't show the projects")).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toHaveTextContent('Mobile app');
    await user.click(within(sidebar()).getByRole('button', { name: 'All projects' }));
    expect(window.location.pathname).toBe('/');
  });
});

function Opener() {
  const sheets = useSheets();
  return (
    <button type="button" onClick={() => sheets.open({ type: 'newProject' })}>
      Open
    </button>
  );
}

describe('regression: a sheet that fails to render', () => {
  it.each([
    ['a desktop', false],
    ['a phone', true],
  ])('shows Something went wrong with Close on %s, and the app keeps working', async (_, phone) => {
    restore.push(mockPhone(phone));
    const user = userEvent.setup();
    renderWithApp(
      <SheetsProvider>
        <Opener />
      </SheetsProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const sheet = screen.getByRole('dialog', { name: 'Something went wrong' });
    expect(within(sheet).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "Sheet newProject couldn't be shown.",
      expect.objectContaining({ message: 'Project sheet crashed' }),
      expect.anything(),
    );
    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog', { name: 'Something went wrong' })).toBeInTheDocument();
  });
});
