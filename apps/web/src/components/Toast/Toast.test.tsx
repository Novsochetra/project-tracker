import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './ToastProvider';
import {
  createToastStore,
  TOAST_EXIT_MS,
  TOAST_SHIELD_MS,
  TOAST_UNDO_MS,
  TOAST_VISIBLE_MS,
  type ToastOptions,
} from './toastStore';
import { useToast, useToastRaise } from './useToast';

function Trigger({ text, options }: { text: string; options?: ToastOptions }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show(text, options)}>
      Show {text}
    </button>
  );
}

function RaisedScreen({ active }: { active: boolean }) {
  useToastRaise(active);
  return null;
}

const toastBox = () => screen.getByRole('status').firstElementChild;
const toastIcon = () => toastBox()?.querySelector('svg');
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the text in a status region, then leaves after 2.2s and unmounts', () => {
    render(
      <ToastProvider>
        <Trigger text="MOB-7 created" />
      </ToastProvider>,
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Show MOB-7 created' }));
    expect(screen.getByRole('status')).toHaveTextContent('MOB-7 created');
    advance(TOAST_VISIBLE_MS - 1);
    expect(toastBox()).not.toHaveClass('leaving');
    advance(1);
    expect(toastBox()).toHaveClass('leaving');
    advance(TOAST_EXIT_MS);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('replaces the current toast and restarts its timer', () => {
    render(
      <ToastProvider>
        <Trigger text="Prompt copied" />
        <Trigger text="MOB-3 deleted" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show Prompt copied' }));
    advance(2000);
    fireEvent.click(screen.getByRole('button', { name: 'Show MOB-3 deleted' }));
    expect(screen.getByRole('status')).toHaveTextContent('MOB-3 deleted');
    expect(screen.getByRole('status')).not.toHaveTextContent('Prompt copied');
    advance(TOAST_VISIBLE_MS - 1);
    expect(toastBox()).not.toHaveClass('leaving');
    advance(1 + TOAST_EXIT_MS);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('marks a success with the check and a failure with the error icon, announced alike', () => {
    render(
      <ToastProvider>
        <Trigger text="MOB-7 created" />
        <Trigger text="Couldn't add “Fix login”" options={{ kind: 'error' }} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show MOB-7 created' }));
    expect(toastIcon()).toHaveClass('lucide-circle-check');
    expect(toastIcon()).not.toHaveClass('errorIcon');

    fireEvent.click(screen.getByRole('button', { name: /^Show Couldn't add/ }));
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't add “Fix login”");
    expect(toastIcon()).toHaveClass('lucide-circle-alert', 'errorIcon');
    expect(toastIcon()).toHaveAttribute('aria-hidden', 'true');
    advance(TOAST_VISIBLE_MS + TOAST_EXIT_MS);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('sits above the phone bottom bar while a screen asks for it', () => {
    const { rerender } = render(
      <ToastProvider>
        <RaisedScreen active />
      </ToastProvider>,
    );
    expect(screen.getByRole('status')).toHaveClass('raised');
    rerender(
      <ToastProvider>
        <RaisedScreen active={false} />
      </ToastProvider>,
    );
    expect(screen.getByRole('status')).not.toHaveClass('raised');
  });

  it('needs a provider to show toasts', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger text="Lost" />)).toThrow('useToast needs a ToastProvider');
    vi.restoreAllMocks();
  });
});

describe('Toast with Undo', () => {
  const undoButton = () => within(screen.getByRole('status')).getByRole('button', { name: 'Undo' });

  function renderMove(undo = vi.fn()) {
    render(
      <ToastProvider>
        <label>
          Title <input />
        </label>
        <Trigger text="MOB-3 moved to Done" options={{ undo }} />
        <Trigger text="Prompt copied" />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show MOB-3 moved to Done' }));
    return undo;
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('offers Undo in the announced toast for 4s, then leaves like any toast', () => {
    const undo = renderMove();
    expect(screen.getByRole('status')).toHaveTextContent('MOB-3 moved to Done');
    expect(undoButton()).toHaveAttribute('aria-keyshortcuts', 'Meta+Z Control+Z');
    expect(toastBox()).toHaveClass('withAction');
    advance(TOAST_UNDO_MS - 1);
    expect(toastBox()).not.toHaveClass('leaving');
    advance(1);
    expect(toastBox()).toHaveClass('leaving');
    advance(TOAST_EXIT_MS);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    expect(undo).not.toHaveBeenCalled();
  });

  it('runs Undo once, takes the toast away and catches a second tap for a moment', () => {
    const undo = renderMove();
    fireEvent.click(undoButton());
    expect(undo).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole('status')).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('shielded');
    advance(TOAST_SHIELD_MS);
    expect(screen.getByRole('status')).not.toHaveClass('shielded');
    advance(TOAST_EXIT_MS);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('undoes with ⌘Z or Ctrl+Z, but not while a text field has focus', () => {
    const undo = renderMove();
    const field = screen.getByRole('textbox', { name: 'Title' });
    act(() => field.focus());
    fireEvent.keyDown(field, { key: 'z', metaKey: true });
    expect(undo).not.toHaveBeenCalled();
    act(() => field.blur());
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('stays while hovered or focused, then gets its full time again', () => {
    renderMove();
    fireEvent.pointerEnter(toastBox()!);
    advance(TOAST_UNDO_MS * 2);
    expect(toastBox()).not.toHaveClass('leaving');
    fireEvent.pointerLeave(toastBox()!);
    act(() => undoButton().focus());
    advance(TOAST_UNDO_MS * 2);
    expect(toastBox()).not.toHaveClass('leaving');
    act(() => undoButton().blur());
    advance(TOAST_UNDO_MS - 1);
    expect(toastBox()).not.toHaveClass('leaving');
    advance(1);
    expect(toastBox()).toHaveClass('leaving');
  });

  it('gives focus back to where it came from when Undo is pressed from the keyboard', () => {
    const undo = renderMove();
    const trigger = screen.getByRole('button', { name: 'Show MOB-3 moved to Done' });
    act(() => trigger.focus());
    act(() => undoButton().focus());
    fireEvent.click(undoButton());
    expect(undo).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });

  it('keeps toasts without an action as they were: 2.2s, no button, taps go through', () => {
    renderMove();
    fireEvent.click(screen.getByRole('button', { name: 'Show Prompt copied' }));
    expect(within(screen.getByRole('status')).queryByRole('button')).not.toBeInTheDocument();
    expect(toastBox()).not.toHaveClass('withAction');
    fireEvent.keyDown(document.body, { key: 'z', metaKey: true });
    expect(screen.getByRole('status')).not.toHaveClass('shielded');
    advance(TOAST_VISIBLE_MS);
    expect(toastBox()).toHaveClass('leaving');
  });
});

describe('createToastStore', () => {
  it('runs an undo once, and only while its toast is the one showing', () => {
    const store = createToastStore();
    const undo = vi.fn();
    store.show('MOB-3 moved to Done', { undo });
    const first = store.getSnapshot().toast!.id;
    store.undo(first);
    store.undo(first);
    expect(undo).toHaveBeenCalledTimes(1);

    store.show('MOB-4 moved to Done', { undo });
    const second = store.getSnapshot().toast!.id;
    store.show('Prompt copied');
    store.undo(second);
    expect(undo).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it('still runs an undo while its toast fades out, but not once it is gone', () => {
    vi.useFakeTimers();
    const store = createToastStore();
    const undo = vi.fn();
    store.show('MOB-3 moved to Done', { undo });
    const id = store.getSnapshot().toast!.id;
    vi.advanceTimersByTime(TOAST_UNDO_MS);
    expect(store.getSnapshot().toast?.leaving).toBe(true);
    store.undo(id);
    expect(undo).toHaveBeenCalledTimes(1);

    store.show('MOB-4 moved to Done', { undo });
    const gone = store.getSnapshot().toast!.id;
    vi.advanceTimersByTime(TOAST_UNDO_MS + TOAST_EXIT_MS);
    expect(store.getSnapshot().toast).toBeNull();
    store.undo(gone);
    expect(undo).toHaveBeenCalledTimes(1);
    store.dispose();
    vi.useRealTimers();
  });

  it('lets an important toast stay its full 4s, and shows the latest one shown meanwhile after', () => {
    vi.useFakeTimers();
    const store = createToastStore();
    const text = () => store.getSnapshot().toast?.text;
    store.show("Text can't be kept", { kind: 'error', important: true });
    store.show('MOB-3 deleted');
    store.show("Can't reach the tracker", { kind: 'error' });
    vi.advanceTimersByTime(TOAST_UNDO_MS - 1);
    expect(text()).toBe("Text can't be kept");
    vi.advanceTimersByTime(1 + TOAST_EXIT_MS);
    expect(text()).toBe("Can't reach the tracker");
    expect(store.getSnapshot().toast?.leaving).toBe(false);
    vi.advanceTimersByTime(TOAST_VISIBLE_MS + TOAST_EXIT_MS);
    expect(store.getSnapshot().toast).toBeNull();

    store.show("Text can't be kept", { kind: 'error', important: true });
    store.show("Text can't be kept, again", { kind: 'error', important: true });
    expect(text()).toBe("Text can't be kept, again");
    store.dispose();
    vi.useRealTimers();
  });

  // Reviewer 61 (PT-76): a toast shown while the important one faded out showed at once, and the
  // older one waiting behind it came after it.
  it('keeps the order of toasts shown while an important toast fades out', () => {
    vi.useFakeTimers();
    const store = createToastStore();
    const text = () => store.getSnapshot().toast?.text;
    store.show("Text can't be kept", { kind: 'error', important: true });
    store.show("Can't reach the tracker", { kind: 'error' });
    vi.advanceTimersByTime(TOAST_UNDO_MS);
    expect(store.getSnapshot().toast?.leaving).toBe(true);
    store.show('MOB-3 moved to Done');
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(text()).toBe('MOB-3 moved to Done');
    vi.advanceTimersByTime(TOAST_VISIBLE_MS + TOAST_EXIT_MS);
    expect(store.getSnapshot().toast).toBeNull();
    store.dispose();
    vi.useRealTimers();
  });
});
