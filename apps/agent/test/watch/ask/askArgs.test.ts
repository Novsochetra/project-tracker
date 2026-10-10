import type { AskOptions } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { askArgs } from '../../../src/watch/ask/askArgs';
import { askJob } from '../fakeTracker';

const SESSION = '11111111-2222-4333-8444-555555555555';
const READ_ONLY = [
  '--permission-mode',
  'plan',
  '--strict-mcp-config',
  '--disallowedTools',
  'Edit',
  'Write',
  'NotebookEdit',
];
const JSON_OUT = ['-p', '--output-format', 'stream-json', '--verbose'];

const argsFor = (options: unknown, resume: string | null = null, permissionMode?: string) =>
  askArgs(askJob('r-1', 'c-1', resume, options as AskOptions | null), permissionMode);

describe('askArgs', () => {
  it('asks for stream-json in plan mode with no MCP servers and no edit tools', () => {
    expect(argsFor({ model: 'default', mode: 'ask' })).toEqual([...JSON_OUT, ...READ_ONLY]);
  });

  it('keeps Plan read-only like Ask, whatever the helper was started with', () => {
    expect(argsFor({ model: 'default', mode: 'plan' }, null, 'bypassPermissions')).toEqual([
      ...JSON_OUT,
      ...READ_ONLY,
    ]);
  });

  it("gives Edit the helper's own permission mode, MCP servers and edit tools", () => {
    expect(argsFor({ model: 'default', mode: 'edit' }, null, 'acceptEdits')).toEqual([
      ...JSON_OUT,
      '--permission-mode',
      'acceptEdits',
    ]);
    expect(argsFor({ model: 'default', mode: 'edit' })).toEqual(JSON_OUT);
  });

  it.each(['opus', 'sonnet', 'haiku'])('picks the %s model by its fixed name', (model) => {
    expect(argsFor({ model, mode: 'ask' })).toEqual([...JSON_OUT, ...READ_ONLY, '--model', model]);
  });

  it('leaves the model to Claude for default', () => {
    expect(argsFor({ model: 'default', mode: 'ask' })).not.toContain('--model');
  });

  it.each([
    ['no options from an older server', null],
    ['missing options', undefined],
    ['an unknown mode', { model: 'default', mode: 'yolo' }],
    ['a flag as the mode', { model: 'default', mode: '--dangerously-skip-permissions' }],
    ['a mode of another type', { model: 'default', mode: ['edit'] }],
    ['options that are not an object', 'edit'],
  ])('falls back to read-only Ask for %s', (_name, options) => {
    expect(argsFor(options, null, 'bypassPermissions')).toEqual([...JSON_OUT, ...READ_ONLY]);
  });

  it.each(['--dangerously-skip-permissions', 'gpt-5', 'claude-opus-4', 'toString', '__proto__', 7])(
    'never makes an argument of a model that is not a fixed name: %s',
    (model) => {
      expect(argsFor({ model, mode: 'ask' })).toEqual([...JSON_OUT, ...READ_ONLY]);
    },
  );

  it('resumes the chat session last', () => {
    const args = argsFor({ model: 'haiku', mode: 'plan' }, SESSION);
    expect(args.slice(-2)).toEqual(['--resume', SESSION]);
  });

  it.each(['--dangerously-skip-permissions', 'abc', `${SESSION} --x`])(
    'never makes an argument of a session id that is not a UUID: %s',
    (id) => {
      expect(argsFor(null, id)).toEqual(argsFor(null));
    },
  );
});
