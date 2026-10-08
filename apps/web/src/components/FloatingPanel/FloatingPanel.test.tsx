import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLICK_SHIELD_MS } from '../../lib/clickShield';
import { FloatingPanel, FloatingPortal } from './FloatingPanel';

const place = vi.fn(() => ({ top: 40, left: 20, up: false, originX: 100 }));

function Panel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <button ref={anchorRef} type="button">
        Row
      </button>
      <FloatingPortal open={open}>
        <FloatingPanel
          open={open}
          anchorRef={anchorRef}
          panelRef={panelRef}
          closeLabel="Close menu"
          place={place}
          onClose={onClose}
          role="listbox"
          aria-label="Priority"
        >
          <button type="button">High</button>
        </FloatingPanel>
      </FloatingPortal>
    </>
  );
}

function Harness({ onClose = () => undefined }: { onClose?: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <Panel
      open={open}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
    />
  );
}

const layer = () => screen.queryByRole('button', { name: 'Close menu' });
const panel = () => document.querySelector<HTMLElement>('[role="listbox"]');

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'elementsFromPoint');
});

describe('FloatingPanel', () => {
  it('sits where it is placed, growing from the corner nearest its row', () => {
    render(<Harness />);
    const frame = panel()!.parentElement!;
    expect(frame).toHaveStyle({ top: '40px', left: '20px' });
    expect(panel()!.style.transformOrigin).toBe('100px 0');
    expect(panel()).toHaveAttribute('data-up', 'false');
    expect(screen.getByRole('listbox', { name: 'Priority' })).toBeInTheDocument();
  });

  it('places itself again when its content changes size', () => {
    const resized: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<Harness />);
    place.mockReturnValueOnce({ top: 12, left: 20, up: true, originX: 100 });
    act(() => resized.forEach((callback) => callback([], {} as ResizeObserver)));
    expect(panel()!.parentElement).toHaveStyle({ top: '12px' });
    expect(panel()).toHaveAttribute('data-up', 'true');
  });

  it('closes on a click outside', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(layer()!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves hidden and inert, its frame taking clicks there until a double-click is over', () => {
    vi.useFakeTimers();
    render(<Harness />);
    act(() => layer()!.click());
    expect(layer()).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(panel()).toHaveAttribute('data-leaving');
    expect(panel()).toHaveAttribute('inert');
    const frame = panel()!.parentElement!;
    expect(frame).not.toHaveAttribute('inert');
    expect(fireEvent.mouseDown(frame)).toBe(false);

    act(() => void vi.advanceTimersByTime(CLICK_SHIELD_MS - 1));
    expect(panel()).not.toBeNull();
    act(() => void vi.advanceTimersByTime(1));
    expect(panel()).toBeNull();
  });

  it('lets the wheel scroll what is under it, and closes', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    const list = document.createElement('div');
    list.style.overflowY = 'auto';
    Object.defineProperty(list, 'clientHeight', { value: 100 });
    Object.defineProperty(list, 'scrollHeight', { value: 400 });
    list.scrollBy = vi.fn();
    document.body.append(list);
    const at = vi.fn().mockReturnValue([layer(), list, document.body]);
    Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: at });

    fireEvent.wheel(layer()!, { deltaY: 120, clientX: 30, clientY: 300 });
    expect(at).toHaveBeenCalledWith(30, 300);
    expect(list.scrollBy).toHaveBeenCalledWith({ left: 0, top: 120 });
    expect(onClose).toHaveBeenCalledTimes(1);
    list.remove();
  });

  it('leaves a pinch zoom to the browser', () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.wheel(layer()!, { deltaY: 10, ctrlKey: true });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
