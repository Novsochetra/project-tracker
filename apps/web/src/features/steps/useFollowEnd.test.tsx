import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useFollowEnd } from './useFollowEnd';

function Steps({ count }: { count: number }) {
  const ref = useRef<HTMLOListElement>(null);
  useFollowEnd(ref, count);
  return <ol ref={ref} />;
}

// The outer box scrolls until the inner one takes over, with the same steps inside.
function Scroller({ which, count }: { which: 'a' | 'b'; count: number }) {
  return (
    <div data-testid="a" style={{ overflowY: 'auto' }}>
      <div data-testid="b" style={{ overflowY: which === 'b' ? 'auto' : 'visible' }}>
        <Steps count={count} />
      </div>
    </div>
  );
}

function sized(element: HTMLElement, scrollTop: number) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 1_000 });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 200 });
  element.scrollTop = scrollTop;
}

describe('useFollowEnd', () => {
  it('follows new steps at the end and stays put once the person scrolled up', () => {
    const { getByTestId, rerender } = render(<Scroller which="a" count={1} />);
    const scroller = getByTestId('a');
    sized(scroller, 800);
    rerender(<Scroller which="a" count={2} />);
    expect(scroller.scrollTop).toBe(1_000);

    sized(scroller, 100);
    act(() => void scroller.dispatchEvent(new Event('scroll')));
    rerender(<Scroller which="a" count={3} />);
    expect(scroller.scrollTop).toBe(100);
  });

  it('listens to the new scroller when the steps move to another one', () => {
    const { getByTestId, rerender } = render(<Scroller which="a" count={1} />);
    rerender(<Scroller which="b" count={1} />);
    const scroller = getByTestId('b');
    sized(scroller, 100);
    act(() => void scroller.dispatchEvent(new Event('scroll')));
    rerender(<Scroller which="b" count={2} />);
    expect(scroller.scrollTop).toBe(100);
  });
});
