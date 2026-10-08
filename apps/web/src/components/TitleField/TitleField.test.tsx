import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TitleField } from './TitleField';

function Controlled({ onEnter = () => undefined }: { onEnter?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <TitleField aria-label="Ticket title" value={value} onChange={setValue} onEnter={onEnter} />
  );
}

const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ticket title' });

describe('TitleField', () => {
  it('is a one-row text area whose keyboard key says Done', () => {
    render(<Controlled />);
    expect(field()).toBeInstanceOf(HTMLTextAreaElement);
    expect(field()).toHaveAttribute('rows', '1');
    expect(field()).toHaveAttribute('enterkeyhint', 'done');
    expect(field()).toHaveClass('title');
  });

  it('hands Enter to onEnter instead of starting a new line', async () => {
    const onEnter = vi.fn();
    render(<Controlled onEnter={onEnter} />);
    await userEvent.type(field(), 'Fix login{Enter}');
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(field()).toHaveValue('Fix login');
    await userEvent.type(field(), '{Shift>}{Enter}{/Shift}');
    expect(onEnter).toHaveBeenCalledTimes(2);
    expect(field()).toHaveValue('Fix login');
  });

  it('leaves Enter to an input method that is composing', () => {
    const onEnter = vi.fn();
    render(<Controlled onEnter={onEnter} />);
    const event = fireEvent.keyDown(field(), { key: 'Enter', isComposing: true });
    expect(event).toBe(true);
    expect(onEnter).not.toHaveBeenCalled();
  });

  it('turns pasted line breaks into spaces and keeps the caret after the paste', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(field(), 'Fix crash');
    field().setSelectionRange(3, 3);
    await user.paste(' the\nlogin');
    expect(field()).toHaveValue('Fix the login crash');
    expect(field().selectionStart).toBe(13);
    await user.keyboard('!');
    expect(field()).toHaveValue('Fix the login! crash');
  });

  it('keeps the length limit and forwards its ref', () => {
    const ref = createRef<HTMLTextAreaElement>();
    const onChange = vi.fn();
    render(
      <TitleField
        ref={ref}
        aria-label="Ticket title"
        maxLength={5}
        value=""
        onChange={onChange}
        onEnter={() => undefined}
      />,
    );
    expect(ref.current).toBe(field());
    expect(field()).toHaveAttribute('maxlength', '5');
  });
});
