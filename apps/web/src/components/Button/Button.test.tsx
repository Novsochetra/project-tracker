import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { IconButton } from '../IconButton';
import { Button } from './Button';

describe('Button', () => {
  it('is a non-submitting button with an optional hidden icon', () => {
    render(
      <Button variant="primary" icon={Plus}>
        New ticket
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'New ticket' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('primary', 'md');
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('ignores clicks while disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" size="header" disabled onClick={onClick}>
        Create
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Create' });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('can submit a form', () => {
    render(<Button type="submit">Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });
});

describe('IconButton', () => {
  it('is named by its aria-label', async () => {
    const onClick = vi.fn();
    render(<IconButton aria-label="New project" icon={Plus} size="xs" onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'New project' }));
    expect(onClick).toHaveBeenCalled();
  });
});
