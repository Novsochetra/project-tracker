import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatChanges, ChatChangesAnswer, ChatGitAction } from '@tracker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeChat, makeChatDetail } from '../../../api/test/chatFixtures';
import { SAMPLE_DIFF } from '../../changes/test/sampleDiff';
import { renderAsk } from '../test/renderAsk';
import { GH_NOTE, MAIN_NOTE, NO_CHANGES_TEXT } from './copy';

const changesOf = (overrides: Partial<ChatChanges> = {}): ChatChanges => ({
  version: 'r-1',
  diff: SAMPLE_DIFF,
  cut: false,
  files: [
    { path: 'src/a.ts', dirtyBefore: false },
    { path: 'logo.png', dirtyBefore: true },
  ],
  branch: 'chat/fix',
  defaultBranch: 'main',
  ghReady: true,
  createdAt: 1,
  ...overrides,
});

const queued = (kind: ChatGitAction['kind']): ChatGitAction => ({
  id: 'g-1',
  kind,
  status: 'queued',
  error: null,
  result: null,
  createdAt: 2,
  endedAt: null,
});

let restore: () => void;

afterEach(() => restore());

function setup(answer: ChatChangesAnswer, phone = false) {
  const changes = answer.changes ?? changesOf();
  const client = {
    getChat: vi.fn().mockResolvedValue(makeChatDetail({ chat: makeChat({ title: 'Fix login' }) })),
    listChats: vi.fn().mockResolvedValue([makeChat()]),
    listRunners: vi.fn().mockResolvedValue([]),
    getChatChanges: vi.fn().mockResolvedValue(answer),
    commitChat: vi.fn().mockResolvedValue({ changes, action: queued('commit') }),
    openChatPullRequest: vi.fn().mockResolvedValue({ changes, action: queued('pull_request') }),
  };
  const rendered = renderAsk({ phone, client });
  restore = rendered.restore;
  return client;
}

const openChanges = async () => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Changes 2' }));
  return { user, sheet: await screen.findByRole('dialog', { name: 'Changes' }) };
};

describe("a chat's changes", () => {
  it('show no button until Claude changed files in the chat', async () => {
    const client = setup({ changes: null, action: null });
    await waitFor(() => expect(client.getChatChanges).toHaveBeenCalledWith('c-1'));
    expect(await screen.findByRole('textbox', { name: 'Question for Claude' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /^Changes/ })).toBeNull();
  });

  it('open the diff view with the branch and the file count', async () => {
    setup({ changes: changesOf({ cut: true }), action: null }, true);
    const { sheet } = await openChanges();
    expect(within(sheet).getByText('On chat/fix')).toBeInTheDocument();
    expect(within(sheet).getByText('2 files')).toBeInTheDocument();
    expect(within(sheet).getByRole('list', { name: 'Changed files' })).toBeInTheDocument();
    expect(within(sheet).getByText(/too large to show whole/)).toBeInTheDocument();
  });

  it("commit only the files the person picks, Claude's own picked first", async () => {
    const client = setup({ changes: changesOf(), action: null });
    const { user, sheet } = await openChanges();
    await user.click(within(sheet).getByRole('button', { name: 'Commit' }));
    const form = await screen.findByRole('dialog', { name: 'Commit' });
    expect(within(form).getByLabelText('Commit message')).toHaveValue('Fix login');
    expect(within(form).getByLabelText('Branch')).toHaveValue('chat/fix');
    expect(within(form).getByRole('checkbox', { name: /src\/a\.ts/ })).toBeChecked();
    expect(within(form).getByRole('checkbox', { name: /logo\.png/ })).not.toBeChecked();
    expect(within(form).getByText('Had your own changes before Claude touched it.')).toBeVisible();
    await user.clear(within(form).getByLabelText('Commit message'));
    await user.type(within(form).getByLabelText('Commit message'), 'Fix the login page');
    await user.click(within(form).getByRole('button', { name: 'Commit' }));
    expect(client.commitChat).toHaveBeenCalledWith('c-1', {
      version: 'r-1',
      message: 'Fix the login page',
      paths: ['src/a.ts'],
    });
    expect(
      await screen.findByText('Waiting for your computer to start the commit…'),
    ).toBeInTheDocument();
  });

  it('open a pull request only after the confirm step', async () => {
    const client = setup({ changes: changesOf(), action: null });
    const { user, sheet } = await openChanges();
    await user.click(within(sheet).getByRole('button', { name: 'Open PR' }));
    const confirm = await screen.findByRole('dialog', { name: 'Open pull request' });
    expect(
      within(confirm).getByText('Push chat/fix to GitHub and open a pull request into main?'),
    ).toBeInTheDocument();
    expect(client.openChatPullRequest).not.toHaveBeenCalled();
    await user.click(within(confirm).getByRole('button', { name: 'Push and open' }));
    expect(client.openChatPullRequest).toHaveBeenCalledWith('c-1', {
      version: 'r-1',
      title: 'Fix login',
      confirm: true,
    });
  });

  it('say Open PR needs gh set up', async () => {
    setup({ changes: changesOf({ ghReady: false }), action: null });
    const { sheet } = await openChanges();
    expect(within(sheet).getByRole('button', { name: 'Open PR' })).toBeDisabled();
    expect(within(sheet).getByText(GH_NOTE)).toBeInTheDocument();
  });

  it('never offer to push the main branch', async () => {
    setup({ changes: changesOf({ branch: 'main' }), action: null });
    const { sheet } = await openChanges();
    expect(within(sheet).getByRole('button', { name: 'Open PR' })).toBeDisabled();
    expect(within(sheet).getByText(MAIN_NOTE)).toBeInTheDocument();
  });

  it('show a failed commit, and no changes left after one', async () => {
    const failed = { ...queued('commit'), status: 'failed' as const, error: 'The commit failed.' };
    setup({ changes: changesOf({ files: [], diff: '' }), action: failed });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Changes 0' }));
    const sheet = await screen.findByRole('dialog', { name: 'Changes' });
    expect(within(sheet).getByRole('alert')).toHaveTextContent('The commit failed.');
    expect(within(sheet).getByText(NO_CHANGES_TEXT)).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Commit' })).toBeDisabled();
  });
});
