import { describe, expect, it } from 'vitest';
import { PROJECT_INSTRUCTIONS_MAX } from '../src/domain/project';
import { createProjectInput, updateProjectInput } from '../src/api/schemas';
import { instructionsBlock } from '../src/logic/instructions';

const INSTRUCTIONS = 'Write in a warm, plain voice.\nCheck every fact against two sources.';

const project = { instructions: '' };
const instructed = { instructions: `  ${INSTRUCTIONS}\n\n` };

describe('instructionsBlock', () => {
  it('gives a heading and the trimmed text', () => {
    expect(instructionsBlock(instructed, '##')).toEqual(['## Project instructions', INSTRUCTIONS]);
  });

  it('gives nothing for missing, empty or blank instructions', () => {
    expect(instructionsBlock({}, '##')).toEqual([]);
    expect(instructionsBlock(project, '##')).toEqual([]);
    expect(instructionsBlock({ instructions: ' \n\t ' }, '##')).toEqual([]);
  });
});

describe('project instructions in the API schemas', () => {
  it('takes instructions up to the limit, trimmed', () => {
    const text = 'x'.repeat(PROJECT_INSTRUCTIONS_MAX);
    expect(createProjectInput.parse({ name: 'Blog', instructions: ` ${text} ` }).instructions).toBe(
      text,
    );
    expect(updateProjectInput.parse({ instructions: text }).instructions).toBe(text);
  });

  it('refuses instructions over the limit', () => {
    const text = 'x'.repeat(PROJECT_INSTRUCTIONS_MAX + 1);
    expect(createProjectInput.safeParse({ name: 'Blog', instructions: text }).success).toBe(false);
    expect(updateProjectInput.safeParse({ instructions: text }).success).toBe(false);
  });

  it('says the limit from the constant', () => {
    const text = 'x'.repeat(PROJECT_INSTRUCTIONS_MAX + 1);
    expect(updateProjectInput.safeParse({ instructions: text }).error?.issues[0]?.message).toBe(
      'Instructions can be up to 20,000 characters.',
    );
  });
});

describe('label instructions', () => {
  const bugLabel = { name: 'Bug', instructions: ' Write a failing test first.\n' };
  const plainLabel = { name: 'Small', instructions: '  ' };

  it('follow the project instructions, one block per label that has some', () => {
    expect(instructionsBlock(instructed, '##', [bugLabel, plainLabel])).toEqual([
      '## Project instructions',
      INSTRUCTIONS,
      '',
      '## Instructions for "Bug" tickets',
      'Write a failing test first.',
    ]);
    expect(instructionsBlock(project, '##', [bugLabel])).toEqual([
      '## Instructions for "Bug" tickets',
      'Write a failing test first.',
    ]);
  });
});
