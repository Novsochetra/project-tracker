import type { SessionState } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import type { TrackerApi } from '../../src/client';
import { EXIT_ERROR, EXIT_OK, EXIT_USAGE, runCli } from '../../src/cli/run';
import type { Config, Env } from '../../src/config';
import { NO_SAVED_CONFIG, withToken, type SavedConfig } from '../../src/savedConfig';
import { fakeClient, rejectWith, returns } from '../fakeClient';
import { memoryStore } from '../memoryStore';

const URL = 'https://tracker.up.railway.app';
const SECRET = 'trk_0123456789abcdef';
const SIGNED_IN: SessionState = { authRequired: true, authenticated: true };

interface Run {
  argv: string[];
  typed?: string;
  tracker?: TrackerApi;
  env?: Env;
  saved?: SavedConfig;
}

async function cli({ argv, typed = SECRET, tracker, env = {}, saved = NO_SAVED_CONFIG }: Run) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const configs: Config[] = [];
  const prompts: string[] = [];
  const store = memoryStore(saved);
  const code = await runCli(argv, {
    env,
    store,
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    readSecret: (prompt) => {
      prompts.push(prompt);
      return Promise.resolve(typed);
    },
    connect: (config) => {
      configs.push(config);
      return tracker ?? fakeClient({ getSession: returns(SIGNED_IN) });
    },
  });
  const out = stdout.join('\n');
  const err = stderr.join('\n');
  return { code, stdout: out, stderr: err, configs, prompts, saved: store.saved };
}

describe('tracker login', () => {
  it('asks for the token, checks it with the tracker and saves it for that tracker', async () => {
    const result = await cli({ argv: ['login', '--url', `${URL}/`], typed: ` ${SECRET}\n` });
    expect(result.code).toBe(EXIT_OK);
    expect(result.prompts).toEqual([`Paste the API token for ${URL}: `]);
    expect(result.configs).toEqual([{ url: URL, token: SECRET, agentName: 'tracker login' }]);
    expect(result.saved).toEqual({ url: URL, tokens: { [URL]: SECRET } });
    expect(result.stdout).toBe(
      `Saved. The CLI and the MCP server now use ${URL} with this token.\n` +
        'It is kept in /home/dara/.config/project-tracker/config.json, which only you can read. Remove it with "tracker logout".',
    );
  });

  it('then sends the saved token to that tracker only', async () => {
    const { saved } = await cli({ argv: ['login', '--url', URL] });
    const projects = fakeClient({ listProjects: returns([]) });
    const online = await cli({ argv: ['projects'], tracker: projects, saved });
    expect(online.configs[0]).toMatchObject({ url: URL, token: SECRET });
    const local = await cli({ argv: ['projects', '--url', 'http://localhost:4100'], saved });
    expect(local.configs[0]?.token).toBeUndefined();
  });

  it('logs in to TRACKER_URL, or the default tracker, without --url', async () => {
    const env = { TRACKER_URL: 'http://192.168.1.20:4100' };
    expect((await cli({ argv: ['login'], env })).saved.url).toBe('http://192.168.1.20:4100');
    expect((await cli({ argv: ['login'] })).saved.url).toBe('http://localhost:4100');
  });

  it('keeps the tokens of other trackers', async () => {
    const saved = withToken(NO_SAVED_CONFIG, 'http://localhost:4100', 'trk_local');
    expect((await cli({ argv: ['login', '--url', URL], saved })).saved.tokens).toEqual({
      'http://localhost:4100': 'trk_local',
      [URL]: SECRET,
    });
  });

  it('saves nothing when the tracker refuses the token', async () => {
    const tracker = fakeClient({ getSession: returns({ ...SIGNED_IN, authenticated: false }) });
    const result = await cli({ argv: ['login', '--url', URL], tracker });
    expect(result).toMatchObject({ code: EXIT_ERROR, stdout: '', saved: NO_SAVED_CONFIG });
    expect(result.stderr).toBe(
      `Error: The tracker at ${URL} didn't accept this token: it was revoked, mistyped or made for another tracker. Create a new one in Connect Claude Code → API tokens.`,
    );
  });

  it('saves nothing when the tracker cannot be reached', async () => {
    const failure = new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') });
    const tracker = fakeClient({ getSession: () => Promise.reject(failure) });
    const result = await cli({ argv: ['login', '--url', URL], tracker });
    expect(result).toMatchObject({ code: EXIT_ERROR, saved: NO_SAVED_CONFIG });
    expect(result.stderr).toBe(
      `Error: Could not reach the tracker at ${URL} (connect ECONNREFUSED). Is it running? Check TRACKER_URL (or --url).`,
    );
  });

  it('notes a tracker that lets agents in without a token, and a token in the environment', async () => {
    const tracker = fakeClient({
      getSession: returns({ authRequired: false, authenticated: true }),
    });
    const result = await cli({ argv: ['login'], tracker, env: { TRACKER_TOKEN: 'old' } });
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout.split('\n').slice(2)).toEqual([
      'This tracker has no owner account yet, so it lets agents in without a token for now.',
      'TRACKER_TOKEN is set here and is used instead of the saved token. Unset it.',
    ]);
  });

  it('refuses an empty answer or one with spaces', async () => {
    const empty = await cli({ argv: ['login'], typed: '  ' });
    expect(empty).toMatchObject({ code: EXIT_USAGE, configs: [], saved: NO_SAVED_CONFIG });
    expect(empty.stderr).toBe('No token given. Copy one from Connect Claude Code → API tokens.');
    const spaced = await cli({ argv: ['login'], typed: 'trk_a trk_b' });
    expect(spaced).toMatchObject({ code: EXIT_USAGE, configs: [] });
  });

  it('refuses a token on the command line, where shell history keeps it', async () => {
    const result = await cli({ argv: ['login', '--token', SECRET] });
    expect(result).toMatchObject({ code: EXIT_USAGE, prompts: [], saved: NO_SAVED_CONFIG });
    expect(result.stderr).toBe(
      'Paste the token when asked, or pipe it in: a --token flag stays in your shell history.\n' +
        'Usage: tracker login [--url URL]',
    );
  });

  it('stops when typing is cancelled', async () => {
    const result = await runCli(['login'], {
      env: {},
      store: memoryStore(),
      stdout: vi.fn(),
      stderr: (text) => expect(text).toBe('Error: Cancelled.'),
      readSecret: () => Promise.reject(new Error('Cancelled.')),
    });
    expect(result).toBe(EXIT_ERROR);
  });

  it('never prints the token', async () => {
    const runs = [
      await cli({ argv: ['login', '--url', URL] }),
      await cli({
        argv: ['login', '--url', URL],
        tracker: fakeClient({ getSession: rejectWith(401, 'unauthorized', 'Sign in.') }),
      }),
    ];
    for (const run of runs) expect(`${run.stdout}${run.stderr}`).not.toContain(SECRET);
  });
});

describe('tracker logout', () => {
  it('forgets the token of the tracker in use', async () => {
    const saved = withToken(withToken(NO_SAVED_CONFIG, 'http://localhost:4100', 'a'), URL, 'b');
    const result = await cli({ argv: ['logout'], saved });
    expect(result).toMatchObject({ code: EXIT_OK, configs: [] });
    expect(result.saved).toEqual({ tokens: { 'http://localhost:4100': 'a' } });
    expect(result.stdout).toBe(
      `Removed the token saved for ${URL}. It still works until you revoke it in Connect Claude Code → API tokens.`,
    );
  });

  it('says when nothing is saved', async () => {
    const result = await cli({ argv: ['logout', '--url', URL] });
    expect(result).toMatchObject({ code: EXIT_OK, stdout: `No token is saved for ${URL}.` });
  });

  it('takes no arguments', async () => {
    const result = await cli({ argv: ['logout', 'everything'] });
    expect(result).toMatchObject({ code: EXIT_USAGE });
    expect(result.stderr).toBe(
      'Unexpected argument "everything".\nUsage: tracker logout [--url URL]',
    );
  });
});
