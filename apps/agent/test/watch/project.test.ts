import { describe, expect, it } from 'vitest';
import { pickProject } from '../../src/watch/project';

const projects = [
  { key: 'MOB', repo: '/Users/dara/code/mobile' },
  { key: 'WEB', repo: '~/code/web/' },
  { key: 'OPS', repo: '' },
];
const folder = (cwd: string) => ({ cwd, home: '/Users/dara', canonical: (path: string) => path });

describe('pickProject', () => {
  it('takes the named project, in any case', () => {
    expect(pickProject(projects, folder('/tmp'), 'web')).toBe('WEB');
    expect(() => pickProject(projects, folder('/tmp'), 'NOPE')).toThrow(
      'Project NOPE was not found on this tracker.',
    );
  });

  it('finds the project whose repo is this folder, ~ and a trailing slash included', () => {
    expect(pickProject(projects, folder('/Users/dara/code/mobile'))).toBe('MOB');
    expect(pickProject(projects, folder('/Users/dara/code/web'))).toBe('WEB');
  });

  it('asks for a name when no project or several use the folder', () => {
    expect(() => pickProject(projects, folder('/Users/dara'))).toThrow(
      'No project has this folder as its repo.',
    );
    const twice = [...projects, { key: 'MOB2', repo: '/Users/dara/code/mobile' }];
    expect(() => pickProject(twice, folder('/Users/dara/code/mobile'))).toThrow(
      'Several projects use this folder (MOB, MOB2).',
    );
  });
});
