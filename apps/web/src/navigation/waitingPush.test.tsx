import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lazy, Suspense, use, type ComponentType } from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetReload, RELOAD_ON_ITS_WAY_MS, reloadPage } from '../lib/pageReload';
import { skipAnimations } from '../overlays/testing';
import { NavigationContext } from './NavigationContext';
import { NavigationProvider } from './NavigationProvider';
import { PUSH_WAIT_LIMIT_MS } from './pushWait';
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

// `behind` are history entries before the first screen, for the browser's Back to reach.
function renderStack(path = '/', behind: string[] = []) {
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
    <MemoryRouter initialEntries={[...behind, path]} initialIndex={behind.length}>
      <NavigationProvider prepare={prepare}>
        <Suspense fallback={<p>Loading</p>}>
          <StackNavigator renderScreen={renderScreen} loading={<p>Loading screen</p>} />
        </Suspense>
        <Probe />
      </NavigationProvider>
    </MemoryRouter>
  );
  return { project, ticket, show: () => render(view()) };
}

const location = () => screen.getByRole('status', { name: 'Location' }).textContent;
const button = (name: string) => screen.getByRole('button', { name });
const layer = (path: string) => document.querySelector(`[data-stack-path="${path}"]`);

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

// PT-104: a chunk that stalled kept the waiting push, and the pressed row, until the browser gave
// up on the request, with nothing else on screen.
describe('a push whose screen’s code stalls', () => {
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const pressedRows = () => document.querySelectorAll('[data-opening]');

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('goes at its time limit to the screen’s loading state and lets its row go', async () => {
    const user = setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await advance(PUSH_WAIT_LIMIT_MS - 1_000);
    expect(location()).toBe('/');
    expect(button('Open MOB')).toHaveAttribute('data-opening');

    await advance(1_000);
    expect(location()).toBe('/p/MOB');
    expect(layer('/p/MOB')).toHaveTextContent('Loading screen');
    expect(pressedRows()).toHaveLength(0);

    await user.click(button('Swipe back'));
    expect(location()).toBe('/');
    expect(button('Open MOB')).toBeInTheDocument();
  });

  it('shows the screen when the code comes later, with no second entry', async () => {
    const user = setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await advance(PUSH_WAIT_LIMIT_MS);
    expect(location()).toBe('/p/MOB');

    await stack.project.arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    expect(location()).toBe('/p/MOB');
    await user.click(button('Back'));
    expect(location()).toBe('/');
    await user.click(button('Browser back'));
    expect(location()).toBe('/');
  });

  it('opens a ticket at its time limit on top of the project on show', async () => {
    const user = setup();
    const stack = await openProject(user);
    await user.click(button('Open MOB-1'));
    await advance(PUSH_WAIT_LIMIT_MS);
    expect(location()).toBe('/p/MOB/1');
    expect(layer('/p/MOB/1')).toHaveTextContent('Loading screen');
    expect(pressedRows()).toHaveLength(0);

    await stack.ticket.arrive();
    expect(await screen.findByText('Ticket MOB-1')).toBeInTheDocument();
    await user.click(button('Browser back'));
    expect(location()).toBe('/p/MOB');
  });

  it('stays cancelled or replaced when its time is up', async () => {
    const user = setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await user.click(button('All projects'));
    await advance(PUSH_WAIT_LIMIT_MS);
    expect(location()).toBe('/');
    expect(layer('/p/MOB')).toBeNull();

    await user.click(button('Open MOB'));
    await advance(PUSH_WAIT_LIMIT_MS / 2);
    await user.click(button('Open WEB'));
    await advance(PUSH_WAIT_LIMIT_MS / 2);
    expect(location()).toBe('/');
    await advance(PUSH_WAIT_LIMIT_MS / 2);
    expect(location()).toBe('/p/WEB');
    expect(layer('/p/MOB')).toBeNull();
  });

  it('leaves nothing for later when the code comes in time, and code in goes at once', async () => {
    const user = setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await stack.project.arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    await advance(PUSH_WAIT_LIMIT_MS);
    expect(location()).toBe('/p/MOB');

    await user.click(button('Back'));
    await user.click(button('Open MOB'));
    expect(location()).toBe('/p/MOB');
    await user.click(button('Back'));
    await user.click(button('Browser back'));
    expect(location()).toBe('/');
  });
});

// PT-108: the browser's Back or Forward to a screen whose code stalled changed the URL and showed
// nothing of the screen: the boundary above the stack kept the screen on show (in a browser, which
// renders a popstate's navigation at once, its spinner took the place of the whole stack) until
// the code arrived.
describe('the browser’s Back or Forward to a screen whose code is on its way', () => {
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function stalledEntryAhead(user: ReturnType<typeof setup>) {
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await advance(PUSH_WAIT_LIMIT_MS);
    expect(layer('/p/MOB')).toHaveTextContent('Loading screen');
    await user.click(button('Browser back'));
    expect(location()).toBe('/');
    await waitFor(() => expect(layer('/p/MOB')).toBeNull());
    return stack;
  }

  it('Forward slides in the screen’s loading state at once, then the screen', async () => {
    const user = setup();
    const stack = await stalledEntryAhead(user);
    await user.click(button('Browser forward'));
    expect(location()).toBe('/p/MOB');
    expect(layer('/p/MOB')).toHaveTextContent('Loading screen');
    expect(screen.queryByText('Loading')).not.toBeInTheDocument();

    await stack.project.arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    await user.click(button('Back'));
    expect(location()).toBe('/');
  });

  it('Back does the same', async () => {
    const user = setup();
    const stack = renderStack('/', ['/p/MOB']);
    stack.show();
    await user.click(button('Browser back'));
    expect(location()).toBe('/p/MOB');
    expect(layer('/p/MOB')).toHaveTextContent('Loading screen');

    await stack.project.arrive();
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
  });

  it('Back from that loading state returns, and the code coming later opens nothing', async () => {
    const user = setup();
    const stack = await stalledEntryAhead(user);
    await user.click(button('Browser forward'));
    await user.click(button('Browser back'));
    expect(location()).toBe('/');
    await waitFor(() => expect(layer('/p/MOB')).toBeNull());

    await stack.project.arrive();
    expect(location()).toBe('/');
    expect(screen.queryByText('Project MOB')).not.toBeInTheDocument();
  });
});

// PT-108 review: a push that waited while the page asked for a reload (its screen's chunk failed)
// was dropped, as the reload would fill its entry with the screen on show; but the mark that a
// reload was asked for stayed, so when the reload didn't happen (Chromium cancels it for a Back
// that comes first), every push after it was dropped too and nothing opened any more.
// PT-119: its row let go at once, and a tap while the new page was still on its way pushed.
describe('a reload asked for while a push waits', () => {
  const advance = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
  const setup = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const reloadThatNeverHappens = () => {
    act(() => reloadPage(() => undefined));
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    forgetReload();
    vi.useRealTimers();
  });

  it('drops that push and keeps its row pressed until the reload’s time is up', async () => {
    const user = setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    reloadThatNeverHappens();
    await stack.project.arrive();
    expect(location()).toBe('/');
    expect(button('Open MOB')).toHaveAttribute('data-opening');

    await advance(RELOAD_ON_ITS_WAY_MS);
    expect(button('Open MOB')).not.toHaveAttribute('data-opening');
    await user.click(button('Open MOB'));
    expect(await screen.findByText('Project MOB')).toBeInTheDocument();
    expect(location()).toBe('/p/MOB');
  });

  it('holds a push made meanwhile the same way, with no history entry', async () => {
    const user = setup();
    const stack = renderStack();
    await stack.project.arrive();
    stack.show();
    reloadThatNeverHappens();
    await advance(300);
    await user.click(button('Open WEB'));
    await advance(100);
    expect(location()).toBe('/');
    expect(button('Open WEB')).toHaveAttribute('data-opening');

    await advance(RELOAD_ON_ITS_WAY_MS);
    expect(button('Open WEB')).not.toHaveAttribute('data-opening');
    expect(location()).toBe('/');
  });

  it('leaves later pushes alone once a Back cancels the reload', async () => {
    const user = setup();
    const stack = renderStack();
    stack.show();
    await user.click(button('Open MOB'));
    await advance(PUSH_WAIT_LIMIT_MS);
    expect(layer('/p/MOB')).toHaveTextContent('Loading screen');
    reloadThatNeverHappens();
    await advance(300);
    await user.click(button('Browser back'));
    expect(location()).toBe('/');

    await user.click(button('Open WEB'));
    await stack.project.arrive();
    expect(await screen.findByText('Project WEB')).toBeInTheDocument();
    expect(location()).toBe('/p/WEB');
    await user.click(button('Back'));
    expect(location()).toBe('/');
  });
});

// PT-104: the Shell put an odd spelling of a path right through a replace, which waited for the
// screen's code like any other, so a cold deep link kept the odd URL until the code arrived.
describe('a deep link to an odd spelling of a path', () => {
  it.each([
    ['/p/MOB/', '/p/MOB'],
    ['/p/MOB/01', '/p/MOB/1'],
    ['/p/MOB/1/', '/p/MOB/1'],
    ['/x/y', '/'],
  ])('%s is put right at start, before any screen’s code', (path, canonical) => {
    renderStack(path).show();
    expect(location()).toBe(canonical);
  });
});
