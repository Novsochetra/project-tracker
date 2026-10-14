import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseDiff, type Activity, type TicketChanges } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { comment, makeTicketDetail } from '../../../api/test/fixtures';
import { skipAnimations } from '../../../overlays/testing';
import { SAMPLE_DIFF } from '../../changes/test/sampleDiff';
import { renderTicket } from '../test/renderTicket';

const RUN = 'run-1';
const LINE = { runId: RUN, path: 'src/a.ts', side: 'old', line: 2 } as const;
const [codeFile] = parseDiff(SAMPLE_DIFF);

const changesOf = (overrides: Partial<TicketChanges> = {}): TicketChanges => ({
  runId: RUN,
  diff: SAMPLE_DIFF,
  cut: false,
  createdAt: 1,
  verdict: null,
  viewed: {},
  ...overrides,
});

let cleanups: Array<() => void> = [];

beforeEach(() => {
  localStorage.clear();
  cleanups = [skipAnimations()];
});

afterEach(() => cleanups.forEach((undo) => undo()));

function setup({
  changes = changesOf(),
  activity = [],
  phone = false,
}: { changes?: TicketChanges | null; activity?: Activity[]; phone?: boolean } = {}) {
  const detail = makeTicketDetail(undefined, { activity });
  let saved = changes;
  const client = {
    getTicketChanges: vi.fn(() => Promise.resolve({ changes: saved })),
    setFileViewed: vi.fn((_key: string, input: { path: string; digest: string }) => {
      if (saved) saved = { ...saved, viewed: { ...saved.viewed, [input.path]: input.digest } };
      return Promise.resolve();
    }),
    sendChangesVerdict: vi.fn().mockResolvedValue(detail),
    addComment: vi.fn((_key: string, input: { text: string; line?: unknown }) =>
      Promise.resolve(comment('c-new', input.text, { line: LINE })),
    ),
  };
  const rendered = renderTicket({ detail, client, phone });
  cleanups.push(rendered.restorePhone);
  return { ...rendered, calls: client };
}

const openChanges = async () => {
  await userEvent.click(await screen.findByRole('button', { name: 'Changes 2' }));
};
const openCodeFile = () => userEvent.click(screen.getByRole('button', { name: /^src\/a\.ts/ }));

describe('the Changes tab', () => {
  it('shows only once a run sent its changes', async () => {
    const { calls } = setup({ changes: null });
    await waitFor(() => expect(calls.getTicketChanges).toHaveBeenCalled());
    expect(screen.queryByRole('group', { name: 'Ticket view' })).toBeNull();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('lists the files with how many are viewed, then the lines of one', async () => {
    setup({ changes: changesOf({ viewed: { 'logo.png': 'old digest' } }) });
    await openChanges();
    expect(screen.queryByLabelText('Title')).toBeNull();
    expect(screen.getByText('0 of 2 viewed')).toBeInTheDocument();
    await openCodeFile();
    expect(
      screen.getByRole('button', { name: /Added line 2:\s*const y = 3;/ }),
    ).toBeInTheDocument();
  });

  it('keeps a viewed tick with the file’s digest and counts it', async () => {
    const { calls } = setup();
    await openChanges();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Viewed src/a.ts' }));
    expect(calls.setFileViewed).toHaveBeenCalledWith('MOB-1', {
      path: 'src/a.ts',
      digest: codeFile?.digest,
      viewed: true,
    });
    expect(await screen.findByText('1 of 2 viewed')).toBeInTheDocument();
  });

  it('shows a line’s comments under it, and sends a new one with its line', async () => {
    const earlier = comment('c-1', 'Why 2?', { line: LINE, createdAt: Date.now() });
    const elsewhere = comment('c-2', 'Older run', { line: { ...LINE, runId: 'run-0' } });
    const { calls } = setup({ activity: [earlier, elsewhere] });
    await openChanges();
    expect(screen.getByText('1 line comment goes to Claude on its next run.')).toBeInTheDocument();
    await openCodeFile();
    expect(screen.getByText('Why 2?')).toBeInTheDocument();
    expect(screen.queryByText('Older run')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Added line 2/ }));
    const box = screen.getByRole('textbox', { name: 'Comment on src/a.ts line 2' });
    expect(box).toHaveFocus();
    await userEvent.type(box, 'Use 4.');
    await userEvent.click(screen.getByRole('button', { name: 'Comment' }));
    expect(calls.addComment).toHaveBeenCalledWith('MOB-1', {
      text: 'Use 4.',
      attachmentIds: [],
      line: { runId: RUN, path: 'src/a.ts', side: 'new', line: 2 },
    });
    expect(screen.queryByRole('textbox', { name: 'Comment on src/a.ts line 2' })).toBeNull();
  });

  it('names a line comment’s line in the activity', async () => {
    const { calls } = setup({ activity: [comment('c-1', 'Why 2?', { line: LINE })] });
    await waitFor(() => expect(calls.getTicketChanges).toHaveBeenCalled());
    const log = screen.getByRole('region', { name: 'Activity' });
    expect(within(log).getByText('On src/a.ts line 2 before the change')).toBeInTheDocument();
  });

  it('keeps an unsent line comment as a draft, which opens again with its text', async () => {
    const first = setup();
    await openChanges();
    await openCodeFile();
    await userEvent.click(screen.getByRole('button', { name: /Removed line 2/ }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Comment on src/a.ts line 2 before the change' }),
      'Keep this',
    );
    first.unmount();
    setup();
    await openChanges();
    await openCodeFile();
    expect(
      screen.getByRole('textbox', { name: 'Comment on src/a.ts line 2 before the change' }),
    ).toHaveValue('Keep this');
  });

  it('approves the changes or asks for changes, naming the changes it saw', async () => {
    const { calls } = setup();
    await openChanges();
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(calls.sendChangesVerdict).toHaveBeenCalledWith('MOB-1', {
      runId: RUN,
      verdict: 'approved',
    });
    expect(await screen.findByText('Approved the changes.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ask for changes' }));
    expect(calls.sendChangesVerdict).toHaveBeenLastCalledWith('MOB-1', {
      runId: RUN,
      verdict: 'changes_requested',
    });
  });

  it('says when a run changed nothing, and when its change was cut', async () => {
    setup({ changes: changesOf({ diff: '', cut: true }) });
    await userEvent.click(await screen.findByRole('button', { name: 'Changes 0' }));
    expect(screen.getByText('Claude changed no files in this run.')).toBeInTheDocument();
    expect(
      screen.getByText('This change is too large to show whole, so its last files are left out.'),
    ).toBeInTheDocument();
  });

  it('fits a phone: the tabs and the two buttons', async () => {
    setup({ phone: true });
    await openChanges();
    const tabs = screen.getByRole('group', { name: 'Ticket view' });
    expect(within(tabs).getByRole('button', { name: 'Changes 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });
});
