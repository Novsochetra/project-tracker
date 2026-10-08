import { describe, expect, it } from 'vitest';
import {
  createdToast,
  createProjectInput,
  EMPTY_PROJECT_FORM,
  formValuesOf,
  hasName,
  prefixPlaceholder,
  projectFormChanged,
  projectHint,
  updateProjectInput,
  type ProjectFormValues,
} from './projectForm';

const form = (patch: Partial<ProjectFormValues>): ProjectFormValues => ({
  ...EMPTY_PROJECT_FORM,
  ...patch,
});

describe('projectHint', () => {
  it('explains prefixes before anything is typed', () => {
    expect(projectHint('new', form({ name: '  ' }))).toBe(
      'Tickets are numbered with a short prefix, like MOB-1. The repository is added to every Claude Code prompt.',
    );
  });

  it('shows the derived prefix once a name is typed', () => {
    expect(projectHint('new', form({ name: 'Mobile app' }))).toBe(
      'Tickets will be numbered MA-1, MA-2 and so on. The repository is added to every Claude Code prompt.',
    );
  });

  it('prefers the typed prefix, cleaned up', () => {
    expect(projectHint('new', form({ name: 'Second', prefix: 'mob' }))).toMatch(
      /^Tickets will be numbered MOB-1, MOB-2 and so on\./,
    );
    expect(projectHint('new', form({ name: '', prefix: 'we-b!' }))).toMatch(
      /numbered WEB-1, WEB-2/,
    );
  });

  it('falls back to PRJ when the typed prefix has nothing usable', () => {
    expect(projectHint('new', form({ name: 'Mobile app', prefix: '--' }))).toMatch(
      /numbered PRJ-1, PRJ-2/,
    );
  });

  it('only talks about the repository when editing', () => {
    expect(projectHint('edit', form({ name: 'Website' }))).toBe(
      'The repository is added to every Claude Code prompt for this project.',
    );
  });
});

describe('prefixPlaceholder', () => {
  it('derives the prefix from the name', () => {
    expect(prefixPlaceholder(form({ name: 'Mobile app' }))).toBe('MA');
    expect(prefixPlaceholder(form({ name: 'Website' }))).toBe('WEB');
    expect(prefixPlaceholder(form({ name: '' }))).toBe('PRJ');
  });
});

describe('hasName', () => {
  it('needs more than whitespace', () => {
    expect(hasName(form({ name: ' ' }))).toBe(false);
    expect(hasName(form({ name: 'A' }))).toBe(true);
  });
});

describe('inputs', () => {
  const values = form({
    name: '  Mobile app ',
    description: ' iOS and Android\n',
    repo: ' ~/code/mobile ',
    prefix: 'mob',
  });

  it('trims the fields and sends the resolved prefix on create', () => {
    expect(createProjectInput(values)).toEqual({
      name: 'Mobile app',
      key: 'MOB',
      description: 'iOS and Android',
      repo: '~/code/mobile',
    });
    expect(createProjectInput(form({ name: 'Mobile app' })).key).toBe('MA');
  });

  it('never sends a prefix on edit', () => {
    expect(updateProjectInput(values)).toEqual({
      name: 'Mobile app',
      description: 'iOS and Android',
      repo: '~/code/mobile',
    });
  });

  it('starts an edit from the project values', () => {
    expect(formValuesOf({ name: 'Website', description: 'Docs', repo: '~/web' })).toEqual({
      name: 'Website',
      description: 'Docs',
      repo: '~/web',
      prefix: '',
    });
  });
});

describe('projectFormChanged', () => {
  it('counts any text typed into a new project, and nothing else', () => {
    const changed = (patch: Partial<ProjectFormValues>) =>
      projectFormChanged(form(patch), EMPTY_PROJECT_FORM);
    expect(changed({})).toBe(false);
    expect(changed({ name: '  ', description: '\n', repo: ' ', prefix: ' ' })).toBe(false);
    expect(changed({ name: 'Garden planner' })).toBe(true);
    expect(changed({ description: 'Seeds and beds' })).toBe(true);
    expect(changed({ repo: '~/code/garden' })).toBe(true);
    expect(changed({ prefix: 'gp' })).toBe(true);
  });

  it('compares an edit with the project it loaded', () => {
    const loaded = formValuesOf({ name: 'Website', description: 'Docs', repo: '~/code/web' });
    const changed = (patch: Partial<ProjectFormValues>) =>
      projectFormChanged({ ...loaded, ...patch }, loaded);
    expect(changed({})).toBe(false);
    expect(changed({ name: ' Website ', description: 'Docs\n' })).toBe(false);
    expect(changed({ name: 'Marketing site' })).toBe(true);
    expect(changed({ name: 'website' })).toBe(true);
    expect(changed({ description: '' })).toBe(true);
    expect(changed({ repo: '~/code/site' })).toBe(true);
  });
});

describe('createdToast', () => {
  it('quotes the name', () => {
    expect(createdToast('Mobile app')).toBe('“Mobile app” created');
  });
});
