import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { fakeClient } from '../../src/api/test/fakeClient';
import { createTestQueryClient } from '../../src/api/test/render';
import { renderScreen } from '../../src/app/renderScreen';
import { LocationProbe } from '../../src/app/test/LocationProbe';
import { currentPath } from '../../src/app/test/harness';
import { TrackerApp } from '../../src/app/TrackerApp';
import { StackNavigator } from '../../src/navigation';
import { mockPhone, skipAnimations } from '../../src/overlays/testing';

// A render error anywhere on a screen unmounted the whole app: a white page with no way back
// short of closing it. On desktop the sidebar and header, which read the same projects answer as
// the screens, still did, because they sat outside every screen's boundary.

const crashing = vi.hoisted(() => ({ projects: false }));

vi.mock('../../src/features/projects/ProjectsScreen', async () => {
  const { createElement } = await import('react');
  return {
    ProjectsScreen: () => {
      if (crashing.projects) throw new Error('Projects screen crashed');
      return createElement('p', null, 'Projects screen');
    },
  };
});

vi.mock('../../src/features/project/ProjectScreen', async () => {
  const { createElement } = await import('react');
  return { ProjectScreen: () => createElement('p', null, 'Project screen') };
});

vi.mock('../../src/features/ticket/TicketScreen', () => ({
  TicketScreen: () => {
    throw new Error('Ticket screen crashed');
  },
}));

let restore: Array<() => void> = [];
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  crashing.projects = false;
  restore = [skipAnimations()];
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

function renderStack(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <StackNavigator renderScreen={renderScreen} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

const layerPaths = () =>
  [...document.querySelectorAll('[data-stack-path]')].map((layer) =>
    layer.getAttribute('data-stack-path'),
  );

describe('regression: a screen that fails to render', () => {
  it('shows Something went wrong with Reload and Back, and Back pops the stack', async () => {
    const user = userEvent.setup();
    renderStack('/p/MOB/3');
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('/p/MOB/3'),
      expect.objectContaining({ message: 'Ticket screen crashed' }),
      expect.anything(),
    );

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(currentPath()).toBe('/p/MOB');
    await waitFor(() => expect(layerPaths()).toEqual(['/', '/p/MOB']));
    expect(screen.getByText('Project screen')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });

  it('offers only Reload on the first screen, which has nothing to go back to', () => {
    crashing.projects = true;
    renderStack('/');
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('still goes back with an edge swipe on a phone', async () => {
    restore.push(mockPhone(true));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 375, height: 812 }),
    );
    renderStack('/p/MOB/3');
    await waitFor(() =>
      expect(document.querySelector('[data-stack-path="/p/MOB/3"]')).toHaveAttribute(
        'data-role',
        'top',
      ),
    );
    const root = document.querySelector('[data-stack-navigator]')!;
    const touch = { pointerId: 3, pointerType: 'touch', isPrimary: true, button: 0, clientY: 300 };
    fireEvent.pointerDown(root, { ...touch, clientX: 6 });
    fireEvent.pointerMove(root, { ...touch, clientX: 26 });
    fireEvent.pointerMove(root, { ...touch, clientX: 220 });
    await new Promise((resolve) => setTimeout(resolve, 120));
    act(() => {
      fireEvent.pointerUp(root, { ...touch, clientX: 220 });
    });
    await waitFor(() => expect(currentPath()).toBe('/p/MOB'));
    await waitFor(() => expect(layerPaths()).toEqual(['/', '/p/MOB']));
  });
});

describe('regression: a screen that fails inside the desktop shell', () => {
  it('keeps the sidebar and header in small fallbacks on a bad projects answer, and Back works', async () => {
    restore.push(mockPhone(false));
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/p/MOB/3');
    const client = fakeClient({
      getSession: () => Promise.resolve({ authRequired: false, authenticated: true }),
      listProjects: () => Promise.resolve([null]),
      getBoard: () => new Promise(() => undefined),
      getTicket: () => new Promise(() => undefined),
    });
    render(<TrackerApp client={client} queryClient={createTestQueryClient()} />);
    const notice = await screen.findByText("Couldn't show the projects");
    expect(screen.getByRole('complementary', { name: 'Projects' })).toContainElement(notice);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "Desktop header couldn't be shown.",
      expect.any(TypeError),
      expect.anything(),
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(window.location.pathname).toBe('/p/MOB'));
    expect(screen.getByText('Project screen')).toBeInTheDocument();
    expect(screen.getByText("Couldn't show the projects")).toBeInTheDocument();
  });
});
