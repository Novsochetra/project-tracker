import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Segmented } from './Segmented';

const OPTIONS = [
  { value: 'all', label: 'All', count: 7 },
  { value: 'active', label: 'Active', count: 5 },
  { value: 'done', label: 'Done', count: 2 },
] as const;

describe('Segmented', () => {
  it('is a labelled group whose selected button is pressed', () => {
    render(
      <Segmented aria-label="Filter tickets" options={OPTIONS} value="active" onChange={vi.fn()} />,
    );
    expect(screen.getByRole('group', { name: 'Filter tickets' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Active 5' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All 7' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Done 2' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the clicked value', async () => {
    const onChange = vi.fn();
    render(<Segmented aria-label="Filter" options={OPTIONS} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Done 2' }));
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('moves the thumb to the selected index', () => {
    const { rerender } = render(
      <Segmented aria-label="Filter" options={OPTIONS} value="all" onChange={vi.fn()} />,
    );
    const group = screen.getByRole('group');
    expect(group.style.getPropertyValue('--index')).toBe('0');
    expect(group.style.getPropertyValue('--count')).toBe('3');
    rerender(<Segmented aria-label="Filter" options={OPTIONS} value="done" onChange={vi.fn()} />);
    expect(group.style.getPropertyValue('--index')).toBe('2');
  });
});
