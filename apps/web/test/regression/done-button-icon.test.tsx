import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { statuses, STATUS } from '../../src/api/test/fixtures';
import { DoneButton } from '../../src/features/ticket/DoneButton';
import { phoneRule } from './phoneCss';

// With a long done name ("Shipped to production and verified") the Latest review card's Move to
// Done squeezed its check icon to 12.8px at 320px and 15.2px at 360px: the label may shrink, to end
// in an ellipsis, and so did the icon beside it. Only the bar's Move to Done kept its icon whole.

const DONE_BUTTON = 'features/ticket/DoneButton.module.css';
const longDone = {
  ...statuses.find((status) => status.id === STATUS.done)!,
  name: 'Shipped to production and verified',
};

it('keeps the check icon of every Move to Done whole, whatever the done name', () => {
  for (const width of [320, 360, 375]) {
    expect(phoneRule(DONE_BUTTON, '.button svg', width).get('flex'), `${width}px`).toBe('none');
  }
});

it('puts the icon right inside the button the rule styles', () => {
  render(<DoneButton done={{ status: longDone, move: vi.fn() }} size="lg" />);
  const button = screen.getByRole('button', { name: 'Move to Shipped to production and verified' });
  expect(button).toHaveClass('button');
  expect(button.querySelector(':scope > svg')).not.toBeNull();
});
