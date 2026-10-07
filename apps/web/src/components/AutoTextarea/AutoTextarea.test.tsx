import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AutoTextarea } from './AutoTextarea';

const LINE_HEIGHT = 20;

function Controlled() {
  const [value, setValue] = useState('');
  return (
    <AutoTextarea
      aria-label="Description"
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
    />
  );
}

describe('AutoTextarea', () => {
  beforeEach(() => {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
      configurable: true,
      get(this: HTMLTextAreaElement) {
        return this.value.split('\n').length * LINE_HEIGHT;
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(HTMLTextAreaElement.prototype, 'scrollHeight');
    vi.restoreAllMocks();
  });

  it('leaves sizing to field-sizing: content where the browser supports it', async () => {
    vi.spyOn(CSS, 'supports').mockReturnValue(true);
    render(<Controlled />);
    const textarea = screen.getByRole('textbox', { name: 'Description' });
    await userEvent.type(textarea, 'one{Enter}two');
    expect(textarea.style.height).toBe('');
  });

  it('grows and shrinks with its content where field-sizing is missing', async () => {
    vi.spyOn(CSS, 'supports').mockReturnValue(false);
    render(<Controlled />);
    const textarea = screen.getByRole('textbox', { name: 'Description' });
    expect(textarea).toHaveStyle({ height: `${LINE_HEIGHT}px` });
    await userEvent.type(textarea, 'one{Enter}two{Enter}three');
    expect(textarea).toHaveStyle({ height: `${3 * LINE_HEIGHT}px` });
    await userEvent.clear(textarea);
    expect(textarea).toHaveStyle({ height: `${LINE_HEIGHT}px` });
  });

  it('grows when uncontrolled too', async () => {
    vi.spyOn(CSS, 'supports').mockReturnValue(false);
    render(<AutoTextarea aria-label="Comment" />);
    const textarea = screen.getByRole('textbox', { name: 'Comment' });
    await userEvent.type(textarea, 'a{Enter}b');
    expect(textarea).toHaveStyle({ height: `${2 * LINE_HEIGHT}px` });
  });

  it('forwards its ref and uses the borderless inline style', () => {
    const ref = createRef<HTMLTextAreaElement>();
    render(<AutoTextarea ref={ref} variant="inline" aria-label="Title" />);
    const textarea = screen.getByRole('textbox', { name: 'Title' });
    expect(ref.current).toBe(textarea);
    expect(textarea).toHaveClass('textarea', 'inline');
  });
});
