import { describe, expect, it } from 'vitest';
import { reviewPrompt } from '../src/prompts/review';
import { workPrompt } from '../src/prompts/work';

describe('work prompt', () => {
  const text = workPrompt.text(' mob ');

  it('runs the worker loop for the project', () => {
    expect(text).toContain('The project key is "MOB".');
    expect(text).toContain('1. Call claim_next_ticket with project "MOB".');
    expect(text).toContain('every comment and the last review');
    expect(text).toContain('Use add_comment to record important decisions');
    expect(text).toContain('Verify before you submit: run the relevant tests');
    expect(text).toContain('Call submit_for_review with a clear summary');
  });

  it('sets the rules for Done, blockers and how many tickets to take', () => {
    expect(text).toContain('Never move a ticket to Done.');
    expect(text).toContain('leave the ticket In progress');
    expect(text).toContain('only if I asked for more than one');
  });

  it('finds the project first when none is given', () => {
    const withoutProject = workPrompt.text(undefined);
    expect(withoutProject).toContain('First call list_projects to find the project key.');
    expect(workPrompt.text('  ')).toBe(withoutProject);
  });
});

describe('review prompt', () => {
  const text = reviewPrompt.text('MOB');

  it('runs the reviewer loop for the project', () => {
    expect(text).toContain('Call list_tickets with project "MOB" and category "in_review"');
    expect(text).toContain('Call get_ticket');
    expect(text).toContain('not just against the report');
    expect(text).toContain('read the diff and the changed files, run the tests');
  });

  it('includes the rating rubric and the approval rule', () => {
    expect(text).toContain('5: fully meets the requirement, with good quality and tests');
    expect(text).toContain('4: meets the requirement, with minor nits');
    expect(text).toContain('3: works, but has notable issues');
    expect(text).toContain('2: partially meets the requirement');
    expect(text).toContain('1: does not meet the requirement');
    expect(text).toContain(
      '"approved" only when the requirement is fully met and your verification passed',
    );
    expect(text).toContain('"changes_requested", with specific, actionable feedback');
    expect(text).toContain('Never move a ticket to Done.');
  });

  it('finds the project first when none is given', () => {
    const withoutProject = reviewPrompt.text(undefined);
    expect(withoutProject).toContain('First call list_projects to find the project key.');
  });
});
