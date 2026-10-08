import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Fold } from './Fold';

// jsdom lays nothing out: each text says how tall it would be.
function mockTextHeights() {
  return vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return Number(this.querySelector('[data-height]')?.getAttribute('data-height') ?? 0);
  });
}

const text = (height: number) => (
  <p data-height={height}>
    Some text <a href="https://example.com/a">near the top</a> and{' '}
    <a href="https://example.com/b">one far below</a>.
  </p>
);

let restore: () => void;

beforeEach(() => {
  restore = mockTextHeights().mockRestore;
});

afterEach(() => restore());

const region = () => screen.getByText('Some text', { exact: false }).closest('[id]')!;

describe('Fold', () => {
  it('folds text longer than about eight lines to eight lines, with Show more', () => {
    render(<Fold enabled>{text(600)}</Fold>);
    const more = screen.getByRole('button', { name: 'Show more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(more).toHaveAttribute('aria-controls', region().id);
    expect(region()).toHaveClass('folded');
    // jsdom computes 16px text at a normal line height, 19.2px.
    expect(region()).toHaveStyle({ maxHeight: '154px' });
  });

  it('leaves short text as it is, without a button', () => {
    render(<Fold enabled>{text(200)}</Fold>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(region()).not.toHaveClass('folded');
  });

  it('opens and closes from the keyboard', async () => {
    const user = userEvent.setup();
    render(<Fold enabled>{text(600)}</Fold>);
    screen.getByRole('button', { name: 'Show more' }).focus();
    await user.keyboard('{Enter}');
    const less = screen.getByRole('button', { name: 'Show less' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    expect(less).toHaveFocus();
    expect(region()).not.toHaveClass('folded');
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Show more' })).toHaveFocus();
    expect(region()).toHaveClass('folded');
  });

  it('opens when the keyboard reaches a link hidden below the fold', () => {
    render(<Fold enabled>{text(600)}</Fold>);
    const below = screen.getByRole('link', { name: 'one far below' });
    vi.spyOn(region(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 168));
    vi.spyOn(below, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 400, 80, 21));
    act(() => below.focus());
    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });

  it('stays folded when the keyboard reaches a link in sight', () => {
    render(<Fold enabled>{text(600)}</Fold>);
    const near = screen.getByRole('link', { name: 'near the top' });
    vi.spyOn(region(), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 168));
    vi.spyOn(near, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 21, 80, 21));
    act(() => near.focus());
    expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
  });

  it('keeps Show less under the finger when the text closes above it', async () => {
    const user = userEvent.setup();
    render(
      <div data-stack-scroller="">
        <Fold enabled>{text(2000)}</Fold>
      </div>,
    );
    const scroller = document.querySelector<HTMLElement>('[data-stack-scroller]')!;
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    scroller.scrollTop = 2500;
    const less = screen.getByRole('button', { name: 'Show less' });
    const top = vi.spyOn(less, 'getBoundingClientRect');
    top.mockReturnValueOnce(new DOMRect(0, 600, 100, 44));
    top.mockReturnValue(new DOMRect(0, -1232, 100, 44));
    await user.click(less);
    expect(scroller.scrollTop).toBe(2500 - 1832);
  });

  it('renders the text alone where folding is off (desktop)', () => {
    const { container } = render(<Fold enabled={false}>{text(600)}</Fold>);
    expect(container.firstElementChild?.tagName).toBe('P');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
