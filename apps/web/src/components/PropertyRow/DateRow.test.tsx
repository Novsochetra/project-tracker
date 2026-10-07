import { formatLongDay } from '@tracker/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateRow } from './DateRow';

function Harness({ initial, onChange }: { initial: string; onChange: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateRow
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('DateRow', () => {
  it('shows None and no clear button without a date', () => {
    render(<DateRow value="" onChange={vi.fn()} />);
    expect(screen.getByText('None')).toHaveClass('unset');
    expect(screen.queryByRole('button', { name: 'Clear due date' })).not.toBeInTheDocument();
  });

  it('shows the long date and clears it, keeping focus in the row', async () => {
    const onChange = vi.fn();
    render(<Harness initial="2026-10-09" onChange={onChange} />);
    expect(screen.getByText(formatLongDay('2026-10-09'))).toHaveClass('set');
    await userEvent.click(screen.getByRole('button', { name: 'Clear due date' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear due date' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Due date')).toHaveFocus();
  });

  it('reports a date picked in the native input', () => {
    const onChange = vi.fn();
    render(<DateRow value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2026-11-02' } });
    expect(onChange).toHaveBeenCalledWith('2026-11-02');
  });

  it('opens the native picker when the row is clicked', async () => {
    const showPicker = vi.fn();
    render(<DateRow value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText<HTMLInputElement>('Due date');
    input.showPicker = showPicker;
    await userEvent.click(input);
    expect(showPicker).toHaveBeenCalled();
  });

  it('turns the icon and value red when overdue', () => {
    render(<DateRow value="2020-01-02" overdue onChange={vi.fn()} />);
    expect(screen.getByText(formatLongDay('2020-01-02'))).toHaveClass('overdue');
  });
});
