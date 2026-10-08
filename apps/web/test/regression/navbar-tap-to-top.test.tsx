import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHONE_QUERY, REDUCED_MOTION_QUERY } from '../../src/lib/media';
import { NavBar, NavBarButton, StackNavigator, type Route } from '../../src/navigation';
import { skipAnimations } from '../../src/overlays/testing';

const onOptions = vi.fn();
const onAdd = vi.fn();

function Screen({ route }: { route: Route }) {
  if (route.name !== 'project') return <NavBar title="Projects" />;
  return (
    <NavBar
      title="Mobile app"
      backLabel="Projects"
      right={
        <>
          <NavBarButton aria-label="Project options" onClick={onOptions}>
            •••
          </NavBarButton>
          <NavBarButton aria-label="New ticket" onClick={onAdd}>
            +
          </NavBarButton>
        </>
      }
    />
  );
}

function mockMedia(matching: string[]): () => void {
  const previous = Object.getOwnPropertyDescriptor(window, 'matchMedia');
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: matching.includes(query),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
  return () => {
    if (previous) Object.defineProperty(window, 'matchMedia', previous);
    else Reflect.deleteProperty(window, 'matchMedia');
  };
}

function renderProject() {
  render(
    <MemoryRouter initialEntries={['/p/MOB']}>
      <StackNavigator renderScreen={(route) => <Screen route={route} />} />
    </MemoryRouter>,
  );
  const scroller = document.querySelector<HTMLElement>(
    '[data-stack-path="/p/MOB"] [data-stack-scroller]',
  )!;
  scroller.scrollTop = 1200;
  const scrollTo = vi.fn();
  scroller.scrollTo = scrollTo;
  return { scrollTo, bar: screen.getByRole('banner') };
}

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
  vi.clearAllMocks();
});

// Each screen scrolls in its own scroller, so iOS's tap-the-top gesture, which only scrolls the
// document, did nothing and the only way back up a long list was flicking.
describe('regression: tapping the phone nav bar scrolls the screen back to the top', () => {
  it('smooth-scrolls the top screen when the title or the bar itself is tapped', async () => {
    restore.push(mockMedia([PHONE_QUERY]));
    const user = userEvent.setup();
    const { scrollTo, bar } = renderProject();
    await user.click(screen.getByText('Mobile app'));
    await user.click(bar);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('jumps without animation when reduced motion is on', async () => {
    restore.push(mockMedia([PHONE_QUERY, REDUCED_MOTION_QUERY]));
    const user = userEvent.setup();
    const { scrollTo } = renderProject();
    await user.click(screen.getByText('Mobile app'));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
  });

  it('leaves back, options and new ticket to their own actions', async () => {
    restore.push(mockMedia([PHONE_QUERY]));
    const user = userEvent.setup();
    const { scrollTo } = renderProject();
    await user.click(screen.getByRole('button', { name: 'Project options' }));
    await user.click(screen.getByRole('button', { name: 'New ticket' }));
    await user.click(screen.getByRole('button', { name: 'Back to Projects' }));
    expect(onOptions).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
