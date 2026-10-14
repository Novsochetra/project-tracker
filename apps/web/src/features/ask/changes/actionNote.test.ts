import type { ChatGitAction } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { actionNote } from './actionNote';

const action = (overrides: Partial<ChatGitAction>): ChatGitAction => ({
  id: 'g-1',
  kind: 'commit',
  status: 'queued',
  error: null,
  result: null,
  createdAt: 1,
  endedAt: null,
  ...overrides,
});

describe('actionNote', () => {
  it('says what the commit or pull request is doing', () => {
    expect(actionNote(null)).toBeNull();
    expect(actionNote(action({}))?.text).toBe('Waiting for your computer to start the commit…');
    expect(actionNote(action({ status: 'running' }))?.text).toBe('Committing…');
    expect(
      actionNote(action({ status: 'done', result: { sha: 'abcdef1234', branch: 'x' } })),
    ).toEqual({
      tone: 'done',
      text: 'Committed abcdef1 on x.',
      url: undefined,
    });
    const url = 'https://github.com/o/r/pull/7';
    expect(actionNote(action({ kind: 'pull_request', status: 'done', result: { url } }))).toEqual({
      tone: 'done',
      text: 'Opened the pull request.',
      url,
    });
  });

  it("shows a failure's own words", () => {
    const failed = action({ status: 'failed', error: 'The commit failed; lint failed' });
    expect(actionNote(failed)).toEqual({ tone: 'failed', text: 'The commit failed; lint failed' });
  });
});
