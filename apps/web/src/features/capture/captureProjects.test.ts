import { afterEach, describe, expect, it, vi } from 'vitest';
import { otherProject } from '../../api/test/fixtures';
import { projectSummary } from '../../app/test/harness';
import {
  canCapture,
  choiceOf,
  defaultProjectKey,
  LAST_PROJECT_STORAGE_KEY,
  projectChoices,
  readLastProject,
  rememberProject,
  resolveProject,
} from './captureProjects';

const mobile = projectSummary({ lastActivityAt: 100 });
const website = projectSummary({ ...otherProject, color: '#D97706', lastActivityAt: 300 });
const docs = projectSummary({ id: 'p-doc', key: 'DOC', name: 'Docs', lastActivityAt: 200 });
const PROJECTS = [mobile, website, docs];
const remembered = { key: 'MOB', name: 'Mobile app', color: '#5B5BD6' };

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('last project used', () => {
  it('is remembered on this device by key and color, never by name', () => {
    expect(readLastProject()).toBeNull();
    rememberProject({ ...remembered, extra: 'dropped' } as typeof remembered);
    expect(readLastProject()).toEqual({ key: 'MOB', name: 'MOB', color: '#5B5BD6' });
    expect(JSON.parse(window.localStorage.getItem(LAST_PROJECT_STORAGE_KEY) ?? '')).toEqual({
      key: 'MOB',
      color: '#5B5BD6',
    });
  });

  it('drops a name kept by an older version', () => {
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, JSON.stringify(remembered));
    expect(readLastProject()?.name).toBe('MOB');
  });

  it('is forgotten when what was stored is not a project', () => {
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, '{"key":"MOB"}');
    expect(readLastProject()).toBeNull();
    window.localStorage.setItem(LAST_PROJECT_STORAGE_KEY, 'MOB');
    expect(readLastProject()).toBeNull();
  });

  it('copes with storage that is blocked or full', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(() => rememberProject(remembered)).not.toThrow();
    expect(readLastProject()).toBeNull();
  });
});

describe('canCapture', () => {
  it('needs a project in the list once the list is there', () => {
    rememberProject(remembered);
    expect(canCapture(PROJECTS)).toBe(true);
    expect(canCapture([])).toBe(false);
  });

  it('needs a last project used while there is no list, as when offline', () => {
    expect(canCapture(undefined)).toBe(false);
    rememberProject(remembered);
    expect(canCapture(undefined)).toBe(true);
  });
});

describe('choiceOf', () => {
  it('names a project as its screens do', () => {
    expect(choiceOf(mobile)).toEqual({ key: 'MOB', name: 'Mobile app', color: mobile.color });
    expect(choiceOf({ ...mobile, hideName: true }).name).toBe('Project MOB');
  });
});

describe('project choice', () => {
  it('offers every project, in list order', () => {
    expect(projectChoices(PROJECTS, remembered).map(({ key }) => key)).toEqual([
      'MOB',
      'WEB',
      'DOC',
    ]);
  });

  it('offers the last project used while the list is unavailable, so offline still works', () => {
    expect(projectChoices(undefined, remembered)).toEqual([remembered]);
    expect(projectChoices(undefined, null)).toEqual([]);
  });

  it('defaults to the last project used, matching its key in any case', () => {
    expect(defaultProjectKey(PROJECTS, { ...remembered, key: 'mob' })).toBe('MOB');
    expect(defaultProjectKey(undefined, remembered)).toBe('MOB');
  });

  it('defaults to the most recently active project when none was used or it is gone', () => {
    expect(defaultProjectKey(PROJECTS, null)).toBe('WEB');
    expect(defaultProjectKey(PROJECTS, { ...remembered, key: 'GONE' })).toBe('WEB');
    expect(defaultProjectKey([], null)).toBeUndefined();
  });

  it('uses the chosen project while it exists, otherwise the default', () => {
    const choices = projectChoices(PROJECTS, null);
    expect(resolveProject(choices, 'DOC', 'WEB')?.key).toBe('DOC');
    expect(resolveProject(choices, 'GONE', 'WEB')?.key).toBe('WEB');
    expect(resolveProject(choices, null, undefined)).toBeUndefined();
  });
});
