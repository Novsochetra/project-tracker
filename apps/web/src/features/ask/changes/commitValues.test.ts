import type { ChatChanges } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import {
  canOpenPullRequest,
  commitInput,
  commitProblem,
  initialBranch,
  initialPicks,
} from './commitValues';

const changesOf = (overrides: Partial<ChatChanges> = {}): ChatChanges => ({
  version: 'r-1',
  diff: '',
  cut: false,
  files: [
    { path: 'a.ts', dirtyBefore: false },
    { path: 'notes.md', dirtyBefore: true },
    { path: 'config/.env.local', dirtyBefore: false },
  ],
  branch: 'chat/fix',
  defaultBranch: 'main',
  ghReady: true,
  createdAt: 1,
  ...overrides,
});

describe('the commit form', () => {
  it("picks only Claude's own files that hold no secrets", () => {
    expect([...initialPicks(changesOf().files)]).toEqual(['a.ts']);
  });

  it('proposes a new branch on the main branch and keeps another', () => {
    expect(initialBranch(changesOf(), 'Fix login')).toBe('chat/fix');
    expect(initialBranch(changesOf({ branch: 'main' }), 'Fix login')).toBe('chat/fix-login');
    expect(initialBranch(changesOf({ branch: null }), 'Fix login')).toBe('chat/fix-login');
  });

  it('sends the picked files in order, and a branch only when it is new', () => {
    const values = { message: ' Fix ', branch: 'chat/fix', picks: new Set(['notes.md', 'a.ts']) };
    expect(commitInput(values, changesOf())).toEqual({
      version: 'r-1',
      message: 'Fix',
      paths: ['a.ts', 'notes.md'],
    });
    expect(commitInput({ ...values, branch: 'chat/new' }, changesOf()).branch).toBe('chat/new');
  });

  it('says what is missing or wrong', () => {
    const values = { message: 'Fix', branch: 'chat/fix', picks: new Set(['a.ts']) };
    expect(commitProblem(values, changesOf())).toBeNull();
    expect(commitProblem({ ...values, message: ' ' }, changesOf())).toBe('Write a commit message.');
    expect(commitProblem({ ...values, picks: new Set() }, changesOf())).toBe(
      'Pick at least one file.',
    );
    expect(commitProblem({ ...values, branch: 'main' }, changesOf())).toBe(
      'main is the main branch.',
    );
    expect(commitProblem({ ...values, branch: '-x' }, changesOf())).not.toBeNull();
    expect(commitProblem({ ...values, branch: '' }, changesOf({ branch: null }))).not.toBeNull();
  });
});

describe('Open PR', () => {
  it('needs gh set up and a branch that is not the main one', () => {
    expect(canOpenPullRequest(changesOf())).toBe(true);
    expect(canOpenPullRequest(changesOf({ ghReady: false }))).toBe(false);
    expect(canOpenPullRequest(changesOf({ branch: 'main' }))).toBe(false);
    expect(canOpenPullRequest(changesOf({ branch: 'develop', defaultBranch: 'develop' }))).toBe(
      false,
    );
    expect(canOpenPullRequest(changesOf({ branch: null }))).toBe(false);
  });
});
