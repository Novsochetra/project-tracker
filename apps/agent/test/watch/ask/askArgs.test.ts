import { describe, expect, it } from 'vitest';
import { askArgs } from '../../../src/watch/ask/askArgs';

const SESSION = '11111111-2222-4333-8444-555555555555';

describe('askArgs', () => {
  it('asks for JSON in plan mode with no MCP servers and no edit tools', () => {
    expect(askArgs(null)).toEqual([
      '-p',
      '--output-format',
      'json',
      '--permission-mode',
      'plan',
      '--strict-mcp-config',
      '--disallowedTools',
      'Edit',
      'Write',
      'NotebookEdit',
    ]);
  });

  it('resumes the chat session last', () => {
    expect(askArgs(SESSION).slice(-2)).toEqual(['--resume', SESSION]);
  });

  it.each(['--dangerously-skip-permissions', 'abc', `${SESSION} --x`])(
    'never makes an argument of a session id that is not a UUID: %s',
    (id) => {
      expect(askArgs(id)).toEqual(askArgs(null));
    },
  );
});
