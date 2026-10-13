import { execFileSync } from 'node:child_process';

export interface Git {
  isClean(): boolean;
  hasTag(tag: string): boolean;
  subjectsSince(tag: string): string[];
  commit(files: readonly string[], message: string): void;
  tag(tag: string, message: string): void;
}

export function createGit(cwd: string): Git {
  const git = (...args: string[]): string =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    isClean: () => git('status', '--porcelain').trim() === '',
    hasTag: (tag) => {
      try {
        git('rev-parse', '--quiet', '--verify', `refs/tags/${tag}`);
        return true;
      } catch {
        return false;
      }
    },
    subjectsSince: (tag) =>
      git('log', '--no-merges', '--format=%s', `${tag}..HEAD`)
        .split('\n')
        .filter((line) => line.trim() !== ''),
    commit: (files, message) => {
      git('add', '--', ...files);
      git('commit', '--quiet', '--message', message);
    },
    tag: (tag, message) => {
      git('tag', '--annotate', tag, '--message', message);
    },
  };
}
