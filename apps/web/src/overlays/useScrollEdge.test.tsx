import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { useScrollEdge } from './useScrollEdge';

function Panel() {
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useScrollEdge(body, panel);

  return (
    <div ref={panel} data-testid="panel">
      <div ref={body} data-testid="body" />
    </div>
  );
}

describe('useScrollEdge', () => {
  it('marks the panel once its body scrolls, and clears it back at the top', () => {
    const view = render(<Panel />);
    const panel = view.getByTestId('panel');
    const body = view.getByTestId('body');
    expect(panel).not.toHaveAttribute('data-scrolled');

    body.scrollTop = 40;
    fireEvent.scroll(body);
    expect(panel).toHaveAttribute('data-scrolled');

    body.scrollTop = 0;
    fireEvent.scroll(body);
    expect(panel).not.toHaveAttribute('data-scrolled');
  });
});
