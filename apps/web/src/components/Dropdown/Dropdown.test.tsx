import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectRow } from '../SelectRow';

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'In progress' },
  { value: 'done', label: 'Done' },
] as const;

type Value = (typeof STATUSES)[number]['value'];

function Harness({ onChange }: { onChange?: (value: Value) => void }) {
  const [value, setValue] = useState<Value>('doing');
  return (
    <SelectRow
      label="Status"
      options={STATUSES}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

async function openMenu() {
  const user = userEvent.setup();
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Status In progress' });
  await user.click(trigger);
  return { user, trigger };
}

describe('Dropdown', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens a labelled listbox with focus on the selected option', async () => {
    const { trigger } = await openMenu();
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox', { name: 'Status' })).toBeInTheDocument();
    const selected = screen.getByRole('option', { name: 'In progress' });
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected).toHaveFocus();
  });

  it('moves with the arrow keys, wrapping at both ends, and jumps with Home and End', async () => {
    const { user } = await openMenu();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Done' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'To do' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: 'Done' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('option', { name: 'To do' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('option', { name: 'Done' })).toHaveFocus();
  });

  it('selects with Enter, closes and returns focus to the trigger', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Status In progress' }));
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('done');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Status Done' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects with Space and with a click', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^Status/ }));
    await user.keyboard('{ArrowUp} ');
    expect(onChange).toHaveBeenLastCalledWith('todo');
    await user.click(screen.getByRole('button', { name: /^Status/ }));
    await user.click(screen.getByRole('option', { name: 'Done' }));
    expect(onChange).toHaveBeenLastCalledWith('done');
  });

  it('closes on Escape without letting a parent sheet see it', async () => {
    const sheetListener = vi.fn();
    document.addEventListener('keydown', sheetListener);
    const { user, trigger } = await openMenu();
    await user.keyboard('{Escape}');
    document.removeEventListener('keydown', sheetListener);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(sheetListener).not.toHaveBeenCalled();
  });

  it('closes on Tab and returns focus to the trigger', async () => {
    const { user, trigger } = await openMenu();
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).not.toHaveAttribute('aria-expanded', 'true');
  });

  it('closes on a click outside', async () => {
    const { user, trigger } = await openMenu();
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes when the page scrolls, but not in the first 300ms', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    await openMenu();
    const scroll = () => act(() => void window.dispatchEvent(new Event('scroll')));
    scroll();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    now.mockReturnValue(1301);
    scroll();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ignores scrolling inside the menu', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    await openMenu();
    now.mockReturnValue(5000);
    act(() => void screen.getByRole('listbox').dispatchEvent(new Event('scroll')));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
