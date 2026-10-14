import { describe, expect, it } from 'vitest';
import { branchNameProblem, isProtectedBranch, proposedBranch } from '../src/logic/git';

describe('branchNameProblem', () => {
  it('takes plain branch names', () => {
    for (const name of ['chat/fix-login', 'feature/PT-237', 'v1.2_fix']) {
      expect(branchNameProblem(name), name).toBeNull();
    }
  });

  it('refuses names git reads as flags or refuses itself, and any other character', () => {
    for (const name of [
      '',
      '-f',
      '--force',
      'a..b',
      'a//b',
      '/a',
      'a/',
      '.hidden',
      'a/.b',
      'a.lock',
      'a.',
      'HEAD',
      'a b',
      'a;rm -rf',
      'a$(x)',
      'über',
      'a@{1}',
      'x'.repeat(101),
    ]) {
      expect(branchNameProblem(name), name).not.toBeNull();
    }
  });
});

describe('isProtectedBranch', () => {
  it('holds main, master and the default branch', () => {
    expect(isProtectedBranch('main', null)).toBe(true);
    expect(isProtectedBranch('master', 'develop')).toBe(true);
    expect(isProtectedBranch('develop', 'develop')).toBe(true);
    expect(isProtectedBranch('chat/x', 'main')).toBe(false);
  });
});

describe('proposedBranch', () => {
  it("makes a valid branch from the chat's title", () => {
    expect(proposedBranch('Fix the login page!')).toBe('chat/fix-the-login-page');
    expect(proposedBranch('???')).toBe('chat/changes');
    expect(branchNameProblem(proposedBranch('x'.repeat(200)))).toBeNull();
  });
});
