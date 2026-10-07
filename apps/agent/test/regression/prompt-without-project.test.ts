import { describe, expect, it } from 'vitest';
import { reviewPrompt } from '../../src/prompts/review';
import { workPrompt } from '../../src/prompts/work';

// Without a project argument the first step read "with project the project key".
describe('prompts without a project argument', () => {
  it('refer to the project key found in the first step', () => {
    const work = workPrompt.text(undefined);
    const review = reviewPrompt.text(undefined);
    expect(work).toContain('1. Call claim_next_ticket with that project key.');
    expect(review).toContain('1. Call list_tickets with that project key and category "in_review"');
    expect(work + review).not.toContain('with project the project key');
  });
});
