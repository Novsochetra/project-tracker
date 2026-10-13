import { describe, expect, it } from 'vitest';
import { trackerAllowedArgs } from '../../../src/watch/mcp/trackerAllowedTools';

const COMMON =
  'mcp__tracker__ask_person,mcp__tracker__get_ticket,mcp__tracker__add_comment,mcp__tracker__attach_file';

describe('trackerAllowedArgs', () => {
  it('lets a work run use the tracker tools its prompt names without asking', () => {
    expect(trackerAllowedArgs({ kind: 'ticket', role: 'work' })).toEqual([
      '--allowedTools',
      `${COMMON},mcp__tracker__submit_for_review`,
    ]);
  });

  it('lets a review run record its review, never submit the work', () => {
    expect(trackerAllowedArgs({ kind: 'ticket', role: 'review' })).toEqual([
      '--allowedTools',
      `${COMMON},mcp__tracker__review_ticket`,
    ]);
  });

  it('makes an Edit question ask before it submits or reviews', () => {
    expect(trackerAllowedArgs({ kind: 'ask', role: 'work' })).toEqual(['--allowedTools', COMMON]);
  });
});
