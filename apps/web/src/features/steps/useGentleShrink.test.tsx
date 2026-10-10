import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGentleShrink } from './useGentleShrink';

let height = 0;
const animate = vi.fn();

function List({ change }: { change: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGentleShrink(ref, change);
  return (
    <div
      ref={(element) => {
        ref.current = element;
        if (!element) return;
        element.getBoundingClientRect = () => ({ height }) as DOMRect;
        element.animate = animate;
      }}
    />
  );
}

afterEach(() => {
  animate.mockClear();
  vi.unstubAllGlobals();
});

describe('useGentleShrink', () => {
  it('eases the list down when a change makes it shorter, and not when it grows', () => {
    height = 584;
    const { rerender } = render(<List change={1} />);
    expect(animate).not.toHaveBeenCalled();
    height = 182;
    rerender(<List change={2} />);
    expect(animate).toHaveBeenCalledWith(
      [{ height: '584px' }, { height: '182px' }],
      expect.objectContaining({ duration: 240 }),
    );
    height = 300;
    rerender(<List change={3} />);
    expect(animate).toHaveBeenCalledTimes(1);
  });

  it('does not move with reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    height = 584;
    const { rerender } = render(<List change={1} />);
    height = 182;
    rerender(<List change={2} />);
    expect(animate).not.toHaveBeenCalled();
  });
});
