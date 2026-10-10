import { describe, expect, it } from 'vitest';
import { promptCallOf } from '../../../src/watch/prompts/promptCall';
import { promptToolArgs, promptToolCommand } from '../../../src/watch/prompts/promptToolArgs';

describe('promptToolArgs', () => {
  it('adds one stdio server holding only the socket, and names its tool as the prompt tool', () => {
    const args = promptToolArgs(
      ['/usr/local/bin/node', '/app/dist/promptTool.js'],
      '/tmp/t/p.sock',
    );
    expect(args).toEqual([
      '--mcp-config',
      expect.any(String),
      '--permission-prompt-tool',
      'mcp__tracker-watch__ask_person',
    ]);
    expect(JSON.parse(args[1]!)).toEqual({
      mcpServers: {
        'tracker-watch': {
          type: 'stdio',
          command: '/usr/local/bin/node',
          args: ['/app/dist/promptTool.js', '/tmp/t/p.sock'],
        },
      },
    });
    expect(args).not.toContain('--strict-mcp-config');
  });
});

describe('promptToolCommand', () => {
  it('runs the built tool beside the CLI with the same node', () => {
    expect(promptToolCommand('/n/node', [], '/app/dist/cli.js')).toEqual([
      '/n/node',
      '/app/dist/promptTool.js',
    ]);
  });

  it('runs the source under tsx with its loader', () => {
    const loader = ['--import', 'file:///x/tsx/loader.mjs'];
    expect(promptToolCommand('/n/node', loader, '/app/src/cli.ts')).toEqual([
      '/n/node',
      ...loader,
      '/app/src/promptTool.ts',
    ]);
  });
});

describe('promptCallOf', () => {
  it("reads Claude Code's call, and nothing else", () => {
    expect(promptCallOf({ tool_name: 'Bash', input: { command: 'ls' }, tool_use_id: 't' })).toEqual(
      { toolName: 'Bash', input: { command: 'ls' } },
    );
    expect(promptCallOf({ tool_name: 'Bash' })).toEqual({ toolName: 'Bash', input: {} });
    expect(promptCallOf({ input: {} })).toBeNull();
    expect(promptCallOf(null)).toBeNull();
  });
});
