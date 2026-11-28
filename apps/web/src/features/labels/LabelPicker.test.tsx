import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Label } from '@tracker/shared';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, sheetTestSetup } from '../../app/test/renderWithApi';
import { playSound } from '../../sound';
import { PICKER_FIELD_LABEL } from './LabelPicker';
import { LabelMenu } from './LabelMenu';

vi.mock('../../sound', () => ({ playSound: vi.fn() }));

const label = (id: string, name: string, position: number): Label => ({
  id,
  projectId: 'p1',
  name,
  color: '#B42318',
  template: '',
  instructions: '',
  position,
  createdAt: 1,
});

const LABELS = [label('l-bug', 'Bug', 0), label('l-ui', 'UI', 1)];
const RELEASE = label('l-new', 'v1.5', 2);

interface HarnessProps {
  labels: Label[];
  onManage?: () => void;
}

function Harness({ labels, onManage }: HarnessProps) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState<string[]>([]);

  return (
    <>
      <button ref={anchorRef} type="button">
        Labels
      </button>
      <LabelMenu
        open
        anchorRef={anchorRef}
        projectKey="MOB"
        labels={labels}
        value={value}
        onChange={setValue}
        onClose={() => undefined}
        onManage={onManage}
      />
    </>
  );
}

function setup(labels: Label[] = LABELS, onManage?: () => void) {
  const createLabel = vi.fn().mockResolvedValue(RELEASE);
  renderWithApi(<Harness labels={labels} onManage={onManage} />, { createLabel });

  return { createLabel, user: userEvent.setup() };
}

const field = () => screen.getByRole('combobox', { name: PICKER_FIELD_LABEL });
const option = (name: string) => screen.getByRole('option', { name });
const activeOption = () => {
  const id = field().getAttribute('aria-activedescendant');

  return id ? document.getElementById(id) : null;
};

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
  vi.mocked(playSound).mockClear();
});

afterEach(() => restore());

describe('the label picker menu', () => {
  it('shows a whole empty state under the field in a project without labels', () => {
    setup([]);
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('placeholder', 'New label, like v1.4');
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
    const title = screen.getByText('No labels yet');
    expect(title.parentElement).toHaveTextContent('Type a name to make the first one.');
  });

  it('offers Create for a typed name, which Enter makes and puts on the ticket', async () => {
    const { createLabel, user } = setup([]);
    await user.keyboard('v1.5');
    const create = option('Create “v1.5”');
    expect(screen.queryByText('No labels yet')).toBeNull();
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    // Enter's row is shown before the arrows pick one.
    expect(activeOption()).toBe(create);
    expect(create).toHaveAttribute('data-active', 'enter');
    await user.keyboard('{Enter}');
    expect(createLabel).toHaveBeenCalledWith('MOB', { name: 'v1.5', color: expect.any(String) });
    await waitFor(() => expect(field()).toHaveValue(''));
    expect(playSound).toHaveBeenCalledWith('tick');
  });

  it('moves through the rows with the arrows while focus stays in the field', async () => {
    const { user } = setup(LABELS, vi.fn());
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(option('Bug'));
    expect(option('Bug')).toHaveAttribute('data-active', 'keyboard');
    expect(field()).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(option('UI')).toHaveAttribute('aria-selected', 'true');
    expect(playSound).toHaveBeenCalledTimes(1);
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(option('Edit labels'));
    await user.keyboard('{ArrowDown}');
    expect(activeOption()).toBe(option('Bug'));
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(activeOption()).toBe(option('UI'));
  });

  it('starts over from Enter’s row once the text changes', async () => {
    const { user } = setup();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('ui');
    expect(activeOption()).toBe(option('UI'));
    expect(option('UI')).toHaveAttribute('data-active', 'enter');
    await user.keyboard('{Enter}');
    expect(option('UI')).toHaveAttribute('aria-selected', 'true');
    expect(field()).toHaveValue('');
  });

  it('highlights the row under the mouse and lets go as it leaves the rows', () => {
    setup();
    fireEvent.pointerMove(option('UI'), { pointerType: 'mouse' });
    expect(option('UI')).toHaveAttribute('data-active', 'pointer');
    fireEvent.pointerLeave(screen.getByRole('listbox', { name: 'Labels' }));
    expect(option('UI')).not.toHaveAttribute('data-active');
    expect(field()).not.toHaveAttribute('aria-activedescendant');
  });

  it('keeps focus in the field when a label is clicked, so typing goes on', async () => {
    const { user } = setup();
    await user.click(option('Bug'));
    expect(option('Bug')).toHaveAttribute('aria-selected', 'true');
    expect(within(option('Bug')).getByText('Bug')).toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it('clears the field with its clear button and keeps typing there', async () => {
    const { user } = setup();
    expect(screen.queryByRole('button', { name: 'Clear' })).toBeNull();
    await user.keyboard('zzz');
    expect(screen.queryByRole('option', { name: 'Bug' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(field()).toHaveValue('');
    expect(field()).toHaveFocus();
    expect(option('Bug')).toBeInTheDocument();
  });

  it('runs Edit labels from the keyboard', async () => {
    const onManage = vi.fn();
    const { user } = setup(LABELS, onManage);
    await user.keyboard('{ArrowUp}{Enter}');
    expect(onManage).toHaveBeenCalledTimes(1);
  });
});
