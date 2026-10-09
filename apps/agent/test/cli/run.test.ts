import { describe, expect, it, vi } from 'vitest';
import type { TrackerApi } from '../../src/client';
import { EXIT_ERROR, EXIT_OK, EXIT_USAGE, runCli } from '../../src/cli/run';
import { USAGE } from '../../src/cli/usage';
import type { Config, Env } from '../../src/config';
import { fakeClient, rejectWith, returns } from '../fakeClient';
import { attachment, detail, projectSummary } from '../fixtures';
import { memoryStore } from '../memoryStore';

async function cli(argv: string[], tracker: TrackerApi = fakeClient({}), env: Env = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const configs: Config[] = [];
  const code = await runCli(argv, {
    env,
    store: memoryStore(),
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    connect: (config) => {
      configs.push(config);
      return tracker;
    },
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n'), configs };
}

const projects = fakeClient({ listProjects: returns([projectSummary()]) });

describe('tracker help', () => {
  it.each([['help'], ['--help'], ['-h'], ['show', '--help']])(
    '%s prints the usage',
    async (...argv) => {
      const result = await cli(argv);
      expect(result).toMatchObject({ code: EXIT_OK, stdout: USAGE, stderr: '' });
      expect(result.configs).toEqual([]);
    },
  );

  it('documents every command and the global flags', () => {
    for (const command of ['projects', 'statuses', 'tickets', 'show', 'create', 'update', 'move']) {
      expect(USAGE).toContain(`\n  ${command}`);
    }
    for (const command of ['comment', 'claim', 'submit', 'review', 'help']) {
      expect(USAGE).toContain(`\n  ${command}`);
    }
    for (const flag of ['--url URL', '--as NAME', '--token TOKEN', '--json']) {
      expect(USAGE).toContain(flag);
    }
    expect(USAGE).toContain('\n  login [--url URL]\n');
    expect(USAGE).toContain('\n  logout [--url URL]\n');
    expect(USAGE).toContain('TRACKER_API_TOKEN');
  });
});

describe('tracker <command>', () => {
  it('prints the formatted result', async () => {
    expect(await cli(['projects'], projects)).toMatchObject({
      code: EXIT_OK,
      stdout: 'MOB · Mobile app · 3 open, 7 total',
      stderr: '',
    });
  });

  it('prints raw JSON with --json', async () => {
    const result = await cli(['projects', '--json'], projects);
    expect(result.code).toBe(EXIT_OK);
    expect(JSON.parse(result.stdout)).toEqual([projectSummary()]);
  });

  it('shows a ticket without downloading its images', async () => {
    const fetchAttachment = vi.fn();
    const tracker = fakeClient({
      getTicket: returns(detail({ attachments: [attachment()] })),
      fetchAttachment,
    });
    const result = await cli(['show', 'MOB-3'], tracker);
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toContain('## Attachments\n- screenshot.png · 1 KB · 1170×2532');
    expect(fetchAttachment).not.toHaveBeenCalled();
  });

  it('shows the contents of text files and links the rest', async () => {
    const log = attachment({ id: 'log', fileName: 'crash.log', mimeType: 'text/plain', size: 9 });
    const pdf = attachment({ id: 'pdf', fileName: 'spec.pdf', mimeType: 'application/pdf' });
    const tracker = fakeClient({
      getTicket: returns(detail({ attachments: [log, pdf] })),
      fetchAttachmentText: returns('boom\nboom'),
      attachmentFileUrl: (id) => `http://t:1/api/attachments/${id}/file`,
    });
    const result = await cli(['show', 'MOB-3'], tracker);
    expect(result.code).toBe(EXIT_OK);
    expect(result.stdout).toContain(
      '- spec.pdf · application/pdf · 1 KB · http://t:1/api/attachments/pdf/file\n\n' +
        'Contents of crash.log:\n```\nboom\nboom\n```',
    );
  });

  it('exits 0 when there is nothing to claim', async () => {
    const tracker = fakeClient({ claimNext: returns(null) });
    expect(await cli(['claim', 'MOB'], tracker)).toMatchObject({
      code: EXIT_OK,
      stdout: 'No tickets to claim in MOB: nothing is waiting in a To do status.',
    });
    expect((await cli(['claim', 'MOB', '--json'], tracker)).stdout).toBe('null');
  });

  it('prints API errors to stderr and exits 1', async () => {
    const tracker = fakeClient({
      getTicket: rejectWith(404, 'not_found', 'Ticket MOB-99 not found.'),
    });
    expect(await cli(['show', 'MOB-99'], tracker)).toEqual({
      code: EXIT_ERROR,
      stdout: '',
      stderr: 'Error: Ticket MOB-99 not found.',
      configs: [expect.any(Object)],
    });
  });

  it('prints tool errors to stderr and exits 1', async () => {
    const result = await cli(['update', 'MOB-3'], fakeClient({}));
    expect(result.code).toBe(EXIT_ERROR);
    expect(result.stderr).toBe(
      'Error: Nothing to update. Pass at least one of: title, description, priority, assignee, due.',
    );
  });

  it('prints usage errors with the command usage and exits 2 without calling the server', async () => {
    const result = await cli(['show']);
    expect(result).toEqual({
      code: EXIT_USAGE,
      stdout: '',
      stderr: 'Missing <KEY>.\nUsage: tracker show <KEY>',
      configs: [],
    });
  });

  it('points to help for unknown commands and options', async () => {
    expect((await cli(['launch'])).stderr).toBe(
      'Unknown command "launch".\nRun "tracker help" for usage.',
    );
    const unknownOption = await cli(['projects', '--force']);
    expect(unknownOption.code).toBe(EXIT_USAGE);
    expect(unknownOption.stderr).toContain("Unknown option '--force'");
  });
});

describe('configuration', () => {
  it('uses the environment', async () => {
    const env = {
      TRACKER_URL: 'https://tracker.example',
      TRACKER_API_TOKEN: 't0k',
      TRACKER_AGENT_NAME: 'Worker',
    };
    const { configs } = await cli(['projects'], projects, env);
    expect(configs).toEqual([
      {
        url: 'https://tracker.example',
        token: 't0k',
        tokenSource: 'TRACKER_API_TOKEN',
        agentName: 'Worker',
      },
    ]);
  });

  it('lets --url, --token and --as override the environment', async () => {
    const env = { TRACKER_URL: 'http://tracker:9000', TRACKER_AGENT_NAME: 'Worker' };
    const argv = ['projects', '--url', 'https://other:1', '--token', 'abc', '--as', 'Reviewer'];
    const { configs } = await cli(argv, projects, env);
    expect(configs).toEqual([
      { url: 'https://other:1', token: 'abc', tokenSource: '--token', agentName: 'Reviewer' },
    ]);
  });

  it('sends no token over plain http to another computer', async () => {
    const env = { TRACKER_URL: 'http://tracker.up.railway.app', TRACKER_API_TOKEN: 'trk_secret' };
    const result = await cli(['projects'], projects, env);
    expect(result).toMatchObject({ code: EXIT_ERROR, stdout: '', configs: [] });
    expect(result.stderr).toBe(
      'Error: Not sending an API token to http://tracker.up.railway.app: on plain http anyone on the network can read it. ' +
        "Use the tracker's https:// address. Only a tracker on this computer (localhost) gets a token over http.",
    );
  });

  it('says which tracker refused which token, without printing it', async () => {
    const tracker = fakeClient({
      listProjects: rejectWith(401, 'unauthorized', 'Sign in to use this tracker.'),
      trackerUrl: 'https://t.example',
      tokenSource: 'TRACKER_API_TOKEN',
    });
    const env = { TRACKER_URL: 'https://t.example', TRACKER_API_TOKEN: 'trk_secret' };
    const result = await cli(['projects'], tracker, env);
    expect(result.code).toBe(EXIT_ERROR);
    expect(result.stderr).toMatch(
      /^Error: The tracker at https:\/\/t\.example refused the token in TRACKER_API_TOKEN: it was revoked/,
    );
    expect(result.stderr).not.toContain('trk_secret');
  });

  it('reports a broken config file without calling the tracker', async () => {
    const store = memoryStore();
    store.read = () => {
      throw new Error('/home/dara/.config/project-tracker/config.json is not valid JSON.');
    };
    const stderr: string[] = [];
    const code = await runCli(['projects'], {
      env: {},
      store,
      stdout: () => undefined,
      stderr: (text) => stderr.push(text),
      connect: () => {
        throw new Error('not called');
      },
    });
    expect(code).toBe(EXIT_ERROR);
    expect(stderr).toEqual([
      'Error: /home/dara/.config/project-tracker/config.json is not valid JSON.',
    ]);
  });
});
