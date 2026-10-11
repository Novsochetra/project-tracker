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
  });

  it('asks the person before each step of an Edit question when the helper got no mode', () => {
    expect(argsFor({ model: 'default', mode: 'edit' })).toEqual([
      ...JSON_OUT,
      '--permission-mode',
      'default',
    ]);
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

  it.each(['low', 'xhigh', 'max'])('passes the %s effort after the model', (effort) => {
    expect(argsFor({ model: 'opus', mode: 'ask', effort })).toEqual([
      ...JSON_OUT,
      ...READ_ONLY,
      '--model',
      'opus',
      '--effort',
      effort,
    ]);
  });

  it.each([
    ['default', { model: 'opus', mode: 'ask', effort: 'default' }],
    ['an older server that sends no effort', { model: 'opus', mode: 'ask' }],
    ['an unknown effort', { model: 'opus', mode: 'ask', effort: 'ultra' }],
    [
      'a flag as the effort',
      { model: 'opus', mode: 'ask', effort: '--dangerously-skip-permissions' },
    ],
    ['Haiku, which has no effort', { model: 'haiku', mode: 'ask', effort: 'high' }],
  ])('sends no effort for %s', (_name, options) => {
    expect(argsFor(options)).not.toContain('--effort');
  });

  it('resumes the chat session last', () => {
    const args = argsFor({ model: 'sonnet', mode: 'plan', effort: 'high' }, SESSION);
    expect(args.slice(-2)).toEqual(['--resume', SESSION]);
  });

  it.each(['--dangerously-skip-permissions', 'abc', `${SESSION} --x`])(
    'never makes an argument of a session id that is not a UUID: %s',
    (id) => {
      expect(argsFor(null, id)).toEqual(argsFor(null));
    },
  );
});
