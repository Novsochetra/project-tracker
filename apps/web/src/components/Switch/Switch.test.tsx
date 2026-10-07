import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Switch } from './Switch';

function Harness() {
  const [checked, setChecked] = useState(true);
  return (
    <Switch checked={checked} onChange={setChecked} aria-label="Move to In progress when sent" />
  );
}

describe('Switch', () => {
  it('toggles with a click and with the keyboard', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'Move to In progress when sent' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
