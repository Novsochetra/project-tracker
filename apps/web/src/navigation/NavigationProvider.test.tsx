import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense, type ComponentType } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skipAnimations } from '../overlays/testing';
import type { Route } from './routes';
import { StackNavigator } from './StackNavigator';
import { useIsOpening, useNavigation } from './useNavigation';

function OpenButton({ name, route }: { name: string; route: Route }) {
  const { push } = useNavigation();
  const opening = useIsOpening(route);
  return (
    <button type="button" data-opening={opening || undefined} onClick={() => push(route)}>
      {name}
    </button>
  );
}

const MOB: Route = { name: 'project', key: 'MOB' };
const WEB: Route = { name: 'project', key: 'WEB' };

function Projects() {
  return (
    <>
      <OpenButton name="Open MOB" route={MOB} />
      <OpenButton name="Open WEB" route={WEB} />
    </>
  );
}

function Project() {
  const { route, back } = useNavigation();
  return (
    <>
      <p>Project {route.name === 'project' ? route.key : ''}</p>
      <button type="button" onClick={back}>
        Back
      </button>
    </>
  );
}

function Probe() {
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Location">{useLocation().pathname}</output>
      <button type="button" onClick={() => void navigate(-1)}>
        Browser back
      </button>
    </>
  );
}

// The Project screen's code, arriving only when the gate opens, like a chunk on a slow network.
function heldProjectScreen() {
  let open = () => undefined as void;
  const arrived = new Promise<void>((resolve) => (open = resolve));
  const Screen = lazy<ComponentType>(async () => {
    await arrived;
    return { default: Project };
  });
  const arrive = () =>
    act(async () => {
      open();
      await arrived;
    });
  return { Screen, arrive };
}

function renderStack() {
  const held = heldProjectScreen();
  render(
    <MemoryRouter>
      <Suspense fallback={<p>Loading</p>}>
        <StackNavigator
          renderScreen={(route) => (route.name === 'projects' ? <Projects /> : <held.Screen />)}
        />
      </Suspense>
      <Probe />
    </MemoryRouter>,
  );
  return held;
}

const location = () => screen.getByRole('status', { name: 'Location' }).textContent;
const button = (name: string) => screen.getByRole('button', { name });

let restore: Array<() => void> = [];

beforeEach(() => {
  restore = [skipAnimations()];
});

afterEach(() => {
  restore.forEach((undo) => undo());
});

describe('a push while the last one waits for its screen', () => {
  it('to the same place is dropped, so one Back returns', async () => {
    const user = userEvent.setup();
    const { arrive } = renderStack();
    await user.click(button('Open MOB'));
    await user.click(button('Open MOB'));
    expect(location()).toBe('/');
    await arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();

    await user.click(button('Back'));
    expect(location()).toBe('/');
    expect(screen.queryByText('Project MOB')).not.toBeInTheDocument();
  });

  it('to another place still goes there', async () => {
    const user = userEvent.setup();
    const { arrive } = renderStack();
    await user.click(button('Open MOB'));
    await user.click(button('Open WEB'));
    await arrive();
    expect(await screen.findByText('Project WEB')).toBeInTheDocument();
    expect(location()).toBe('/p/WEB');
  });

  it('marks the place on its way until its screen opens', async () => {
    const user = userEvent.setup();
    const { arrive } = renderStack();
    await user.click(button('Open MOB'));
    expect(button('Open MOB')).toHaveAttribute('data-opening');
    expect(button('Open WEB')).not.toHaveAttribute('data-opening');

    await arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    await user.click(button('Back'));
    expect(button('Open MOB')).not.toHaveAttribute('data-opening');
  });

  it('is forgotten after a Back, so the same place can be opened again', async () => {
    const user = userEvent.setup();
    const { arrive } = renderStack();
    await user.click(button('Open MOB'));
    await user.click(button('Browser back'));
    act(() => void window.dispatchEvent(new PopStateEvent('popstate')));
    expect(button('Open MOB')).not.toHaveAttribute('data-opening');

    await user.click(button('Open MOB'));
    await arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    expect(location()).toBe('/p/MOB');
  });
});
