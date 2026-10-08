import { render, screen } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useOwnTouch } from './useOwnTouch';

function Body({ onBodyTouch }: { onBodyTouch: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const handleRef = useOwnTouch<HTMLButtonElement>();
  useEffect(() => {
    const body = bodyRef.current;
    body?.addEventListener('touchstart', onBodyTouch);
    return () => body?.removeEventListener('touchstart', onBodyTouch);
  }, [onBodyTouch]);
  return (
    <div ref={bodyRef}>
      <button ref={handleRef} type="button">
        Handle
      </button>
      <button type="button">Row</button>
    </div>
  );
}

const touch = (element: HTMLElement) =>
  element.dispatchEvent(new Event('touchstart', { bubbles: true }));

describe('useOwnTouch', () => {
  it('keeps touches on the handle from reaching the sheet body', () => {
    const onBodyTouch = vi.fn();
    render(<Body onBodyTouch={onBodyTouch} />);
    touch(screen.getByRole('button', { name: 'Handle' }));
    expect(onBodyTouch).not.toHaveBeenCalled();
    touch(screen.getByRole('button', { name: 'Row' }));
    expect(onBodyTouch).toHaveBeenCalledTimes(1);
  });
});
