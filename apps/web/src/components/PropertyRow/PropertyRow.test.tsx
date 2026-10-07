import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InfoRow } from './InfoRow';
import { InputRow } from './InputRow';
import { PropertyRow } from './PropertyRow';

describe('PropertyRow', () => {
  it('passes popup state through to the button', async () => {
    const onClick = vi.fn();
    render(
      <PropertyRow
        icon={null}
        label="Priority"
        value="High"
        aria-haspopup="listbox"
        aria-expanded={false}
        onClick={onClick}
      />,
    );
    const row = screen.getByRole('button', { name: 'Priority High' });
    expect(row).toHaveAttribute('aria-haspopup', 'listbox');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(row);
    expect(onClick).toHaveBeenCalled();
  });
});

describe('InputRow', () => {
  it('labels the input and offers suggestions', async () => {
    const onChange = vi.fn();
    render(
      <InputRow
        icon={null}
        label="Assignee"
        placeholder="Unassigned"
        suggestions={['Dara', 'Sophea']}
        defaultValue=""
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Assignee' });
    const list = document.getElementById(input.getAttribute('list') ?? '');
    expect(list?.querySelectorAll('option')).toHaveLength(2);
    await userEvent.type(input, 'Da');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('is a plain text box without suggestions', () => {
    render(<InputRow icon={null} label="Repository" mono defaultValue="~/code/app" />);
    expect(screen.getByRole('textbox', { name: 'Repository' })).toHaveValue('~/code/app');
  });
});

describe('InfoRow', () => {
  it('shows the label and the value', () => {
    render(<InfoRow label="Created">Oct 2, 2026</InfoRow>);
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Oct 2, 2026')).toBeInTheDocument();
  });
});
