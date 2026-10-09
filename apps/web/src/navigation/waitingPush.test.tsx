import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense, use, type ComponentType } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { skipAnimations } from '../overlays/testing';
import { NavigationContext } from './NavigationContext';
import { NavigationProvider } from './NavigationProvider';
import { routeStack, type Route } from './routes';
import { StackNavigator } from './StackNavigator';
import { useIsOpening, useNavigation } from './useNavigation';

// PT-100: a push waiting for its screen's code had already added its history entry. A second
// place pushed another (Back then showed the first), a push to the screen on show left the waiting
// one behind, and Back while it waited only went back to the screen on show.

const PROJECTS: Route = { name: 'projects' };
const MOB: Route = { name: 'project', key: 'MOB' };
const WEB: Route = { name: 'project', key: 'WEB' };
const MOB_1: Route = { name: 'ticket', key: 'MOB', num: 1 };

function OpenButton({ name, route }: { name: string; route: Route }) {
  const { push } = useNavigation();
  const opening = useIsOpening(route);
  return (
    <button type="button" data-opening={opening || undefined} onClick={() => push(route)}>
      {name}
    </button>
  );
}

function Projects() {
  return (
    <>
      <OpenButton name="Open MOB" route={MOB} />
      <OpenButton name="Open WEB" route={WEB} />
      <OpenButton name="All projects" route={PROJECTS} />
    </>
  );
}

function Project() {
  const { route, back } = useNavigation();
  return (
    <>
      <p>Project {route.name === 'project' ? route.key : ''}</p>
      <OpenButton name="Open MOB-1" route={MOB_1} />
      <button type="button" onClick={back}>
        Back
      </button>
    </>
  );
}

function Ticket() {
  const { route } = useNavigation();
  return <p>Ticket {route.name === 'ticket' ? `${route.key}-${route.num}` : ''}</p>;
}

function Probe() {
  const navigate = useNavigate();
  const navigation = use(NavigationContext);
  return (
    <>
      <output aria-label="Location">{useLocation().pathname}</output>
      <button type="button" onClick={() => void navigate(-1)}>
        Browser back
      </button>
      <button type="button" onClick={() => void navigate(1)}>
        Browser forward
      </button>
      <button type="button" onClick={() => navigation?.finishSwipeBack()}>
        Swipe back
      </button>
    </>
  );
}

// A screen's code, arriving only when its gate opens, like a chunk on a slow network.
function heldCode(Screen: ComponentType) {
  let open = () => undefined as void;
  let arrived = false;
  const code = new Promise<void>((resolve) => (open = resolve)).then(() => {
    arrived = true;
  });
  const Lazy = lazy(async () => {
    await code;
    return { default: Screen };
  });
  const arrive = () =>
    act(async () => {
      open();
      await code;
    });
  return { Lazy, waiting: () => (arrived ? null : code), arrive };
}

function renderStack(path = '/') {
  const project = heldCode(Project);
  const ticket = heldCode(Ticket);
  const codeFor = (route: Route) => (route.name === 'project' ? project : ticket);
  const prepare = (route: Route) => {
    const waiting = routeStack(route)
      .filter((level) => level.name !== 'projects')
      .map((level) => codeFor(level).waiting())
      .filter((code) => code !== null);
    return waiting.length > 0 ? Promise.all(waiting) : null;
  };
  const renderScreen = (route: Route) => {
    if (route.name === 'projects') return <Projects />;
    const { Lazy } = codeFor(route);
    return <Lazy />;
  };
  const view = () => (
    <MemoryRouter initialEntries={[path]}>
      <NavigationProvider prepare={prepare}>
        <Suspense fallback={<p>Loading</p>}>
          <StackNavigator renderScreen={renderScreen} />
        </Suspense>
        <Probe />
      </NavigationProvider>
    </MemoryRouter>
  );
  return { project, ticket, show: () => render(view()) };
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

async function openProject(user: ReturnType<typeof userEvent.setup>) {
  const stack = renderStack();
  await stack.project.arrive();
  stack.show();
  await user.click(button('Open MOB'));
  expect(await screen.findByText('Project MOB')).toBeInTheDocument();
  return stack;
}

describe('a push waiting for its screen’s code', () => {
  it('keeps its row pressed until the screen opens', async () => {
    const user = userEvent.setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    expect(location()).toBe('/');
    expect(button('Open MOB')).toHaveAttribute('data-opening');

    await stack.project.arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    expect(location()).toBe('/p/MOB');
  });

  it('to the same place again goes once, so one Back returns', async () => {
    const user = userEvent.setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await user.click(button('Open MOB'));
    await stack.project.arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();

    await user.click(button('Back'));
    expect(location()).toBe('/');
    await user.click(button('Browser back'));
    expect(location()).toBe('/');
  });
});

describe('a push to another place while one waits', () => {
  it('takes its place, so one Back returns from the screen it opens', async () => {
    const user = userEvent.setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await user.click(button('Open WEB'));
    expect(button('Open MOB')).not.toHaveAttribute('data-opening');
    await stack.project.arrive();
    expect(await screen.findByText('Project WEB')).toBeInTheDocument();
    expect(location()).toBe('/p/WEB');

    await user.click(button('Back'));
    expect(location()).toBe('/');
    expect(screen.queryByText('Project MOB')).not.toBeInTheDocument();
  });

  it('to the screen on show cancels it and adds nothing', async () => {
    const user = userEvent.setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await user.click(button('All projects'));
    expect(button('Open MOB')).not.toHaveAttribute('data-opening');
    await stack.project.arrive();
    expect(location()).toBe('/');

    await user.click(button('Browser back'));
    expect(location()).toBe('/');
    expect(screen.queryByText('Project MOB')).not.toBeInTheDocument();
  });
});

describe('a Back while a push waits', () => {
  it('in the app cancels it and goes back from the screen on show', async () => {
    const user = userEvent.setup();
    const stack = await openProject(user);
    await user.click(button('Open MOB-1'));
    expect(button('Open MOB-1')).toHaveAttribute('data-opening');
    await user.click(button('Back'));
    expect(location()).toBe('/');

    await stack.ticket.arrive();
    expect(location()).toBe('/');
    expect(screen.queryByText('Ticket MOB-1')).not.toBeInTheDocument();
    await user.click(button('Browser forward'));
    expect(location()).toBe('/p/MOB');
    await user.click(button('Browser forward'));
    expect(location()).toBe('/p/MOB');
  });

  it('by the browser goes back from the screen on show too', async () => {
    const user = userEvent.setup();
    const stack = await openProject(user);
    await user.click(button('Open MOB-1'));
    await user.click(button('Browser back'));
    expect(location()).toBe('/');

    await stack.ticket.arrive();
    expect(location()).toBe('/');
    expect(screen.queryByText('Ticket MOB-1')).not.toBeInTheDocument();
  });

  it('by the edge swipe goes back from the screen on show too', async () => {
    const user = userEvent.setup();
    const stack = await openProject(user);
    await user.click(button('Open MOB-1'));
    await user.click(button('Swipe back'));
    expect(location()).toBe('/');

    await stack.ticket.arrive();
    expect(location()).toBe('/');
  });

  it('from a deep link reaches the parent with nothing left behind it', async () => {
    const user = userEvent.setup();
    const stack = renderStack('/p/MOB');
    await stack.project.arrive();
    stack.show();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    await user.click(button('Open MOB-1'));
    await user.click(button('Back'));
    expect(location()).toBe('/');

    await user.click(button('Browser back'));
    expect(location()).toBe('/');
    await stack.ticket.arrive();
    expect(location()).toBe('/');
  });
});
