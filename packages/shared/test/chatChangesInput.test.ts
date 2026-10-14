import { describe, expect, it } from 'vitest';
import {
  chatCommitInput,
  chatPullRequestInput,
  finishGitActionInput,
} from '../src/api/chatChanges';

const RUNNER = '7f1c3c6e-5d3a-4a39-9a4e-4b0b6a1f2c3d';

describe('chatCommitInput', () => {
  it('takes a message, files and an optional new branch', () => {
    const input = { version: 'r-1', message: 'Fix login', paths: ['a.ts'], branch: 'chat/fix' };
    expect(chatCommitInput.safeParse(input).success).toBe(true);
    expect(chatCommitInput.safeParse({ ...input, branch: undefined }).success).toBe(true);
  });

  it('refuses no files, a blank message, a NUL and a branch git would read as a flag', () => {
    const input = { version: 'r-1', message: 'Fix', paths: ['a.ts'] };
    expect(chatCommitInput.safeParse({ ...input, paths: [] }).success).toBe(false);
    expect(chatCommitInput.safeParse({ ...input, message: '  ' }).success).toBe(false);
    expect(chatCommitInput.safeParse({ ...input, paths: ['a\0b'] }).success).toBe(false);
    expect(chatCommitInput.safeParse({ ...input, branch: '--force' }).success).toBe(false);
    expect(chatCommitInput.safeParse({ ...input, message: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('chatPullRequestInput', () => {
  it('needs the confirm step', () => {
    expect(chatPullRequestInput.safeParse({ version: 'r-1', title: 'Fix' }).success).toBe(false);
    expect(
      chatPullRequestInput.safeParse({ version: 'r-1', title: 'Fix', confirm: true }).success,
    ).toBe(true);
  });
});

describe('finishGitActionInput', () => {
  it('takes only an https pull request address and a hex commit', () => {
    const done = { runnerId: RUNNER, status: 'done' };
    const ok = { ...done, result: { sha: 'abc1234', url: 'https://github.com/o/r/pull/1' } };
    expect(finishGitActionInput.safeParse(ok).success).toBe(true);
    const http = { ...done, result: { url: 'javascript:alert(1)' } };
    expect(finishGitActionInput.safeParse(http).success).toBe(false);
    expect(finishGitActionInput.safeParse({ ...done, result: { sha: 'zz' } }).success).toBe(false);
  });
});
