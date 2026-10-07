import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { skipAnimations } from '../overlays/testing';
import { HAPTIC_PATTERNS } from './haptics';
import { SwipeActions } from './SwipeActions';

const ROW_WIDTH = 375;

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 5));

function drag(target: Element, dx: number, pointerType = 'touch') {
  const base = { pointerId: 7, pointerType, isPrimary: true, button: 0, clientY: 20 };
  fireEvent.pointerDown(target, { ...base, clientX: 200 });
  fireEvent.pointerMove(target, { ...base, clientX: 200 + dx / 2 });
  fireEvent.pointerMove(target, { ...base, clientX: 200 + dx });
  fireEvent.pointerUp(target, { ...base, clientX: 200 + dx });
}

function Row({
  name,
  onOpen = vi.fn(),
  onNext = vi.fn(),
  onDelete = vi.fn(),
}: {
  name: string;
  onOpen?: () => void;
  onNext?: () => void;
  onDelete?: () => void;
}) {
  return (
    <SwipeActions
      leading={[{ label: 'Next', tone: 'accent', onTrigger: onNext }]}
      trailing={[
        { label: 'Delete', tone: 'danger', onTrigger: onDelete },
        { label: 'Status', tone: 'neutral', onTrigger: vi.fn() },
      ]}
    >
      <button type="button" onClick={onOpen}>
        {name}
      </button>
      <span data-no-swipe="">Handle {name}</span>
    </SwipeActions>
  );
}

const rowOf = (name: string) =>
  screen.getByRole('button', { name }).closest('[data-swipe-open], div')!;
const rootOf = (name: string) => screen.getByRole('button', { name }).parentElement!.parentElement!;

let restore: () => void = () => undefined;

beforeEach(() => {
  restore = skipAnimations();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: ROW_WIDTH,
    bottom: 52,
    width: ROW_WIDTH,
    height: 52,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  restore();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SwipeActions', () => {
  it('reveals the trailing actions on a left swipe', () => {
    render(<Row name="MOB-3" />);
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    drag(rowOf('MOB-3'), -120);
    expect(rootOf('MOB-3')).toHaveAttribute('data-swipe-open', 'trailing');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('reveals the leading action on a right swipe', () => {
    render(<Row name="MOB-3" />);
    drag(rowOf('MOB-3'), 90);
    expect(rootOf('MOB-3')).toHaveAttribute('data-swipe-open', 'leading');
  });

  it('runs a revealed action and closes', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(<Row name="MOB-3" onDelete={onDelete} />);
    drag(rowOf('MOB-3'), -160);
    await nextTask();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(rootOf('MOB-3')).not.toHaveAttribute('data-swipe-open');
  });

  it('closes on a touch elsewhere', () => {
    render(<Row name="MOB-3" />);
    drag(rowOf('MOB-3'), -120);
    fireEvent.pointerDown(document.body);
    expect(rootOf('MOB-3')).not.toHaveAttribute('data-swipe-open');
  });

  it('only closes when the open row itself is tapped', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<Row name="MOB-3" onOpen={onOpen} />);
    drag(rowOf('MOB-3'), -120);
    await nextTask();
    await user.click(screen.getByRole('button', { name: 'MOB-3' }));
    expect(onOpen).not.toHaveBeenCalled();
    expect(rootOf('MOB-3')).not.toHaveAttribute('data-swipe-open');
    await user.click(screen.getByRole('button', { name: 'MOB-3' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('runs the first action on a full swipe with a haptic tick at the threshold', async () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, vibrate });
    const onNext = vi.fn();
    render(<Row name="MOB-3" onNext={onNext} />);
    drag(rowOf('MOB-3'), ROW_WIDTH * 0.7);
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.selection);
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1));
    expect(rootOf('MOB-3')).not.toHaveAttribute('data-swipe-open');
  });

  it('swallows a tap on another row that only closes the open one', async () => {
    const onOpenSecond = vi.fn();
    render(
      <>
        <Row name="MOB-1" />
        <Row name="MOB-2" onOpen={onOpenSecond} />
      </>,
    );
    drag(rowOf('MOB-1'), -120);
    await nextTask();
    const second = screen.getByRole('button', { name: 'MOB-2' });
    fireEvent.pointerDown(second, { pointerId: 11, pointerType: 'touch', isPrimary: true });
    fireEvent.pointerUp(second, { pointerId: 11, pointerType: 'touch', isPrimary: true });
    fireEvent.click(second);
    expect(onOpenSecond).not.toHaveBeenCalled();
    expect(rootOf('MOB-1')).not.toHaveAttribute('data-swipe-open');
  });

  it('keeps only one row open', () => {
    render(
      <>
        <Row name="MOB-1" />
        <Row name="MOB-2" />
      </>,
    );
    drag(rowOf('MOB-1'), -120);
    drag(rowOf('MOB-2'), -120);
    expect(rootOf('MOB-1')).not.toHaveAttribute('data-swipe-open');
    expect(rootOf('MOB-2')).toHaveAttribute('data-swipe-open', 'trailing');
  });

  it('ignores mouse drags and drags that start on a data-no-swipe element', () => {
    render(<Row name="MOB-3" />);
    drag(rowOf('MOB-3'), -120, 'mouse');
    expect(rootOf('MOB-3')).not.toHaveAttribute('data-swipe-open');
    drag(screen.getByText('Handle MOB-3'), -120);
    expect(rootOf('MOB-3')).not.toHaveAttribute('data-swipe-open');
  });

  it('ignores vertical drags so the list can scroll', () => {
    render(<Row name="MOB-3" />);
    const row = rowOf('MOB-3');
    const base = { pointerId: 9, pointerType: 'touch', isPrimary: true, button: 0, clientX: 200 };
    fireEvent.pointerDown(row, { ...base, clientY: 20 });
    fireEvent.pointerMove(row, { ...base, clientY: 80 });
    fireEvent.pointerMove(row, { ...base, clientX: 60, clientY: 90 });
    fireEvent.pointerUp(row, { ...base, clientX: 60, clientY: 90 });
    expect(rootOf('MOB-3')).not.toHaveAttribute('data-swipe-open');
  });
});
