import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TitleField } from './TitleField';

interface ControlledProps {
  onEnter?: () => void;
  maxLength?: number;
}

function Controlled({ onEnter = () => undefined, maxLength }: ControlledProps) {
  const [value, setValue] = useState('');
  return (
    <TitleField
      aria-label="Ticket title"
      maxLength={maxLength}
      value={value}
      onChange={setValue}
      onEnter={onEnter}
    />
  );
}

const field = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Ticket title' });

afterEach(() => {
  Reflect.deleteProperty(document, 'execCommand');
});

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

  it('leaves Enter to an input method whose composition Safari already ended', () => {
    const onEnter = vi.fn();
    render(<Controlled onEnter={onEnter} />);
    const event = fireEvent.keyDown(field(), { key: 'Enter', keyCode: 229 });
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

  it("pastes through the browser's own insert, so undo takes the paste back", async () => {
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
    const user = userEvent.setup();
    render(<Controlled />);
    await user.type(field(), 'Fix crash');
    field().setSelectionRange(3, 3);
    await user.paste(' the\r\n\r\n login \n');
    expect(execCommand).toHaveBeenCalledWith('insertText', false, ' the login');
  });

  it('joins the lines of a paste before the length limit cuts it', async () => {
    const user = userEvent.setup();
    render(<Controlled maxLength={12} />);
    await user.type(field(), 'abc');
    await user.paste('de\n\n\n\nfghij');
    expect(field()).toHaveValue('abcde fghij');
  });

  it('adds no space for a line break at the start of a paste', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(field());
    await user.paste('\nLeading break');
    expect(field()).toHaveValue('Leading break');
  });

  it('opens with the caret after the title it already has', () => {
    render(
      <TitleField
        aria-label="Ticket title"
        value="Kept idea"
        onChange={() => undefined}
        onEnter={() => undefined}
      />,
    );
    expect(field().selectionStart).toBe('Kept idea'.length);
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
