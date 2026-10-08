import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS, statuses } from '../../../api/test/fixtures';
import { StackNavigator } from '../../../navigation';
import { TicketScreen } from '../TicketScreen';
import { NO_HOVER_QUERY, PHONE_QUERY, REDUCED_MOTION_QUERY } from '../../../lib/media';
import { skipAnimations } from '../../../overlays/testing';
import { renderTicket } from '../test/renderTicket';

// jsdom has no IntersectionObserver; this one reports where the comment box is when told.
const observers = new Set<FakeIntersectionObserver>();

class FakeIntersectionObserver {
  targets: Element[] = [];
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options: IntersectionObserverInit,
  ) {
    observers.add(this);
  }
  observe(target: Element) {
    this.targets.push(target);
  }
  disconnect() {
    observers.delete(this);
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
}

const SCREEN_BOTTOM = 812;

function boxAt(top: number) {
  act(() => {
    for (const observer of observers) {
      const entries = observer.targets.map((target) => ({
        target,
        isIntersecting: top < SCREEN_BOTTOM * 1.5,
        boundingClientRect: new DOMRect(0, top, 343, 130),
        rootBounds: new DOMRect(0, 0, 375, SCREEN_BOTTOM * 1.5),
      }));
      observer.callback(entries as unknown as IntersectionObserverEntry[], {} as never);
    }
  });
}

const scroller = () =>
  document.querySelector<HTMLElement>('[data-stack-path="/p/MOB/1"] [data-stack-scroller]')!;

// jsdom's screen has no height, so any scroll down counts as past its first quarter.
function scrollTo(top: number) {
  act(() => {
    scroller().scrollTop = top;
    scroller().dispatchEvent(new Event('scroll'));
  });
}

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
  vi.unstubAllGlobals();
  observers.clear();
});

function setup(statusId: string = STATUS.progress) {
  const detail = makeTicketDetail(listItem(1, statusId, 0), { statuses });
  const stack = (
    <StackNavigator
      renderScreen={(route) =>
        route.name === 'ticket' ? <TicketScreen projectKey={route.key} num={route.num} /> : null
      }
    />
  );
  const updateTicket = vi.fn().mockReturnValue(new Promise(() => undefined));
  const rendered = renderTicket({ detail, phone: true, children: stack, client: { updateTicket } });
  cleanups.push(rendered.restorePhone);
  return rendered;
}

// Replaces the phone mock renderTicket set up, which its cleanup puts back.
function mockMedia(matching: string[]) {
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
}

const bar = () => document.querySelector<HTMLElement>('[data-bottom-bar]')!;
const jump = () => within(bar()).queryByRole('button', { name: 'Go to the comment box' });

describe('the jump to the comment box', () => {
  it('shows above the bar while the comment box is far below the screen', async () => {
    setup();
    await screen.findByLabelText('Comment');
    const observer = [...observers].find((candidate) =>
      candidate.targets.some((target) => target.tagName === 'FORM'),
    );
    expect(observer?.options.rootMargin).toBe('0px 0px 50% 0px');
    expect(observer?.options.root).toBe(scroller());
    expect(jump()).not.toBeInTheDocument();
    boxAt(4000);
    scrollTo(300);
    expect(jump()).toHaveTextContent('Comment');
  });

  it('leaves the first screen uncovered until the reader scrolls down', async () => {
    setup();
    await screen.findByLabelText('Comment');
    boxAt(4000);
    expect(jump()).not.toBeInTheDocument();
    scrollTo(300);
    expect(jump()).toBeInTheDocument();
    scrollTo(0);
    expect(jump()).not.toBeInTheDocument();
  });

  it('hides near the bottom', async () => {
    setup();
    await screen.findByLabelText('Comment');
    boxAt(4000);
    scrollTo(300);
    expect(jump()).toBeInTheDocument();
    boxAt(900);
    expect(jump()).not.toBeInTheDocument();
  });

  it('scrolls to the comment box and puts the cursor in it', async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    cleanups.push(() => Reflect.deleteProperty(Element.prototype, 'scrollIntoView'));
    setup();
    const field = await screen.findByLabelText('Comment');
    boxAt(4000);
    scrollTo(300);
    await user.click(jump()!);
    expect(field).toHaveFocus();
    expect(scrolled).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(scrolled.mock.contexts[0]).toBe(field.closest('form'));
  });

  it('jumps without motion when motion is reduced', async () => {
    const user = userEvent.setup();
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    cleanups.push(() => Reflect.deleteProperty(Element.prototype, 'scrollIntoView'));
    setup();
    mockMedia([PHONE_QUERY, REDUCED_MOTION_QUERY]);
    await screen.findByLabelText('Comment');
    boxAt(4000);
    scrollTo(300);
    await user.click(jump()!);
    expect(scrolled).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' });
  });

  it('goes with the bar while a field is edited on a touch phone', async () => {
    const user = userEvent.setup();
    setup();
    mockMedia([PHONE_QUERY, NO_HOVER_QUERY]);
    await screen.findByLabelText('Comment');
    boxAt(4000);
    scrollTo(300);
    expect(jump()).toBeInTheDocument();
    await user.click(screen.getByLabelText('Title'));
    expect(bar()).toHaveAttribute('data-hidden');
    expect(jump()).not.toBeInTheDocument();
    await user.tab();
    await waitFor(() => expect(jump()).toBeInTheDocument());
  });

  it('makes way for a toast, which sits in the same place', async () => {
    const user = userEvent.setup();
    setup(STATUS.todo);
    await screen.findByLabelText('Comment');
    boxAt(4000);
    scrollTo(300);
    await user.click(screen.getByRole('button', { name: /^Priority/ }));
    await user.click(screen.getByRole('option', { name: 'High' }));
    await user.click(screen.getByRole('button', { name: /^Status/ }));
    await user.click(screen.getByRole('option', { name: 'In progress' }));
    expect(await screen.findByText('MOB-1 moved to In progress')).toBeInTheDocument();
    expect(jump()).not.toBeInTheDocument();
    await waitFor(() => expect(jump()).toBeInTheDocument(), { timeout: 6000 });
  });
});
