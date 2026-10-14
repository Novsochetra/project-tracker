import { describe, expect, it } from 'vitest';
import { projectDisplayName, projectDisplayRepo } from '../src/logic/projectDisplayName';

describe('projectDisplayName', () => {
  it('shows the name of a project that does not hide it', () => {
    expect(projectDisplayName({ name: 'Mobile app', key: 'MOB', hideName: false })).toBe(
      'Mobile app',
    );
  });

  it('shows the key instead of a hidden name', () => {
    expect(projectDisplayName({ name: 'Secret launch', key: 'SL', hideName: true })).toBe(
      'Project SL',
    );
  });

  it('shows the name when an older tracker sends no setting', () => {
    expect(projectDisplayName({ name: 'Website', key: 'WEB' })).toBe('Website');
  });
});

describe('projectDisplayRepo', () => {
  it('shows the folder of a project that does not hide its name', () => {
    expect(projectDisplayRepo({ repo: '~/code/web', hideName: false })).toBe('~/code/web');
    expect(projectDisplayRepo({ repo: '~/code/web' })).toBe('~/code/web');
  });

  it('shows no folder for a project that hides its name', () => {
    expect(projectDisplayRepo({ repo: '~/code/secret-launch', hideName: true })).toBe('');
  });
});
