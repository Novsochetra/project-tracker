import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './ToastProvider';
import { TOAST_EXIT_MS, TOAST_VISIBLE_MS } from './toastStore';
import { useToast, useToastRaise } from './useToast';

function Trigger({ text }: { text: string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show(text)}>
      Show {text}
    </button>
  );
}

function RaisedScreen({ active }: { active: boolean }) {
  useToastRaise(active);
  return null;
}

const toastBox = () => screen.getByRole('status').firstElementChild;
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
