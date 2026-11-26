import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmCard } from './ConfirmCard';

describe('ConfirmCard', () => {
  it('announces the question and moves focus to Cancel', () => {
    render(
      <ConfirmCard
        message="Delete MOB-3? This can't be undone."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent("Delete MOB-3? This can't be undone.");
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms and cancels', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmCard message="Delete?" onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('asks for something that can be undone with a primary button', () => {
    render(
      <ConfirmCard
        message="Move all 12 tickets to Done?"
        confirmLabel="Move to Done"
        confirmVariant="primary"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const confirm = screen.getByRole('button', { name: 'Move to Done' });
    expect(confirm).toHaveClass('primary');
    expect(confirm).not.toHaveClass('danger');
  });

  it('blocks a second delete while the first is pending', () => {
    render(<ConfirmCard message="Delete?" pending onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });
});
