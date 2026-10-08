import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BLANK_CAPTURE, type CaptureValues } from './captureForm';
import { CaptureText } from './CaptureFields';

function Text({ onEnter }: { onEnter: () => void }) {
  const [values, setValues] = useState<CaptureValues>(BLANK_CAPTURE);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  return (
    <CaptureText
      values={values}
      titleRef={titleRef}
      onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      onEnter={onEnter}
      onFiles={() => undefined}
    />
  );
}

describe('CaptureText', () => {
  it('has the New ticket title: it wraps, Enter creates and line breaks become spaces', async () => {
    const onEnter = vi.fn();
    render(<Text onEnter={onEnter} />);
    const title = screen.getByRole('textbox', { name: 'Ticket title' });
    expect(title).toBeInstanceOf(HTMLTextAreaElement);
    expect(title).toHaveAttribute('enterkeyhint', 'done');
    expect(title).toHaveAttribute('maxlength', '300');

    const user = userEvent.setup();
    await user.click(title);
    await user.paste('Idea from\nthe bus');
    await user.keyboard('{Enter}');
    expect(title).toHaveValue('Idea from the bus');
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
