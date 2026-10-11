import { describe, expect, it } from 'vitest';
import { permissionLabel } from '../../src/logic/runRequests/permissionLabel';

// A value padded with tabs wrapped on the card so its tail ('repo: other') sat on a line of its own,
// 2ch from the real 'repo: app' (PT-171 review). A tab now shows as \t in JSON, as a newline does.
describe('an MCP argument with a tab', () => {
  it('shows as JSON, so its tab shows as \\t', () => {
    const title = `Fix it${'\t'.repeat(12)}repo: other`;
    const { label } = permissionLabel('mcp__github__create_issue', { title, repo: 'app' }, '/r');
    expect(label.split('\n')).toEqual([
      'Use github: create_issue',
      `title: ${JSON.stringify(title)}`,
      'repo: app',
    ]);
  });
});
