import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFileDropGuard } from './useFileDropGuard';
import { useImageDrop } from './useImageDrop';

interface FakeTransfer {
  types: string[];
  files: File[];
  items: [];
  dropEffect: string;
}

function drag(type: 'dragover' | 'drop', types = ['Files']) {
  const dataTransfer: FakeTransfer = { types, files: [], items: [], dropEffect: 'copy' };
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  return { event, dataTransfer };
}

function Zone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const drop = useImageDrop(onFiles);
  return <div data-testid="zone" {...drop.handlers} />;
}

describe('useFileDropGuard', () => {
  it('refuses file drags and drops outside the drop zones', () => {
    renderHook(() => useFileDropGuard());
    const over = drag('dragover');
    document.body.dispatchEvent(over.event);
    expect(over.event.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe('none');
    const dropped = drag('drop');
    document.body.dispatchEvent(dropped.event);
    expect(dropped.event.defaultPrevented).toBe(true);
  });

  it('leaves drop zones and text drags alone', () => {
    const onFiles = vi.fn();
    renderHook(() => useFileDropGuard());
    render(<Zone onFiles={onFiles} />);
    const over = drag('dragover');
    screen.getByTestId('zone').dispatchEvent(over.event);
    expect(over.dataTransfer.dropEffect).toBe('copy');
    const text = drag('drop', ['text/plain']);
    document.body.dispatchEvent(text.event);
    expect(text.event.defaultPrevented).toBe(false);
  });

  it('stops guarding when unmounted', () => {
    const { unmount } = renderHook(() => useFileDropGuard());
    unmount();
    const dropped = drag('drop');
    document.body.dispatchEvent(dropped.event);
    expect(dropped.event.defaultPrevented).toBe(false);
  });
});
