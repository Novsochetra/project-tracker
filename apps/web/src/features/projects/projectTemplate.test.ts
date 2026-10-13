import { PROJECT_TEMPLATES } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_PROJECT_FORM, type ProjectFormValues } from './projectForm';
import { TEMPLATE_OPTIONS, templateHint, withTemplate } from './projectTemplate';

const form = (patch: Partial<ProjectFormValues>): ProjectFormValues => ({
  ...EMPTY_PROJECT_FORM,
  ...patch,
});

describe('withTemplate', () => {
  it('fills an empty field with the starter', () => {
    expect(withTemplate(form({}), 'writing')).toEqual(
      form({ template: 'writing', instructions: PROJECT_TEMPLATES.writing.instructions }),
    );
  });

  it('treats a blank field as empty', () => {
    expect(withTemplate(form({ instructions: '  \n' }), 'research').instructions).toBe(
      PROJECT_TEMPLATES.research.instructions,
    );
  });

  it('replaces the last template’s untouched starter, and Software empties it', () => {
    const writing = withTemplate(form({}), 'writing');
    expect(withTemplate(writing, 'personal').instructions).toBe(
      PROJECT_TEMPLATES.personal.instructions,
    );
    expect(withTemplate(writing, 'software').instructions).toBe('');
  });

  it('keeps typed or edited instructions', () => {
    expect(withTemplate(form({ instructions: 'Plain lists.' }), 'personal')).toEqual(
      form({ template: 'personal', instructions: 'Plain lists.' }),
    );
    const edited = `${PROJECT_TEMPLATES.writing.instructions}\nShort posts.`;
    const writing = form({ template: 'writing', instructions: edited });
    expect(withTemplate(writing, 'research').instructions).toBe(edited);
  });
});

describe('template options and hint', () => {
  it('lists Software first, by label', () => {
    expect(TEMPLATE_OPTIONS[0]).toEqual({ value: 'software', label: 'Software' });
    expect(TEMPLATE_OPTIONS.map((option) => option.label)).toEqual([
      'Software',
      'Writing',
      'Research',
      'Operations',
      'Personal',
    ]);
  });

  it('names the statuses a template makes', () => {
    expect(templateHint('operations')).toBe('Statuses: To do, Doing, Needs check, Checked, Done.');
  });
});
