import { TrackerClient } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { createTrackerClient } from '../src/client';
import { DEFAULT_AGENT_NAME, DEFAULT_URL, loadConfig } from '../src/config';
import { PlainHttpError } from '../src/plainHttp';
import { NO_SAVED_CONFIG, withToken } from '../src/savedConfig';

const RAILWAY = 'https://tracker.up.railway.app';

describe('loadConfig', () => {
  it('has defaults for the URL and the agent name', () => {
    expect(loadConfig({})).toEqual({
      url: DEFAULT_URL,
      token: undefined,
      agentName: DEFAULT_AGENT_NAME,
    });
    expect(DEFAULT_URL).toBe('http://localhost:4100');
    expect(DEFAULT_AGENT_NAME).toBe('Claude');
  });

  it('reads TRACKER_URL, TRACKER_API_TOKEN and TRACKER_AGENT_NAME', () => {
    const env = {
      TRACKER_URL: 'https://t.example',
      TRACKER_API_TOKEN: 'trk_new',
      TRACKER_TOKEN: 'old',
      TRACKER_AGENT_NAME: 'Reviewer',
    };
    expect(loadConfig(env)).toEqual({
      url: 'https://t.example',
      token: 'trk_new',
      tokenSource: 'TRACKER_API_TOKEN',
      agentName: 'Reviewer',
    });
  });

  it('still takes the token from TRACKER_TOKEN, its old name', () => {
    expect(loadConfig({ TRACKER_TOKEN: ' secret ' })).toMatchObject({
      token: 'secret',
      tokenSource: 'TRACKER_TOKEN',
    });
  });

  it('prefers overrides and ignores blank values', () => {
    const env = { TRACKER_URL: '  ', TRACKER_API_TOKEN: ' ', TRACKER_AGENT_NAME: 'Worker' };
    expect(loadConfig(env, { as: ' Bot ', token: '' })).toEqual({
      url: DEFAULT_URL,
      token: undefined,
      agentName: 'Bot',
    });
    expect(loadConfig({ TRACKER_API_TOKEN: 'env' }, { token: 'flag' })).toMatchObject({
      token: 'flag',
      tokenSource: '--token',
    });
  });

  it('uses the tracker and token saved by tracker login', () => {
    const saved = withToken(NO_SAVED_CONFIG, RAILWAY, 'trk_saved');
    expect(loadConfig({}, {}, saved)).toEqual({
      url: RAILWAY,
      token: 'trk_saved',
      tokenSource: 'tracker login',
      agentName: 'Claude',
    });
    expect(loadConfig({ TRACKER_URL: `${RAILWAY}/` }, {}, saved).token).toBe('trk_saved');
  });

  it('never sends a saved token to another tracker', () => {
    const saved = withToken(NO_SAVED_CONFIG, RAILWAY, 'trk_saved');
    expect(loadConfig({ TRACKER_URL: 'http://localhost:4100' }, {}, saved)).toEqual({
      url: 'http://localhost:4100',
      token: undefined,
      agentName: 'Claude',
    });
    expect(loadConfig({}, { url: 'https://evil.example' }, saved).token).toBeUndefined();
  });

  it('lets a token in the environment win over the saved one', () => {
    const saved = withToken(NO_SAVED_CONFIG, RAILWAY, 'trk_saved');
    expect(loadConfig({ TRACKER_API_TOKEN: 'trk_env' }, {}, saved)).toMatchObject({
      url: RAILWAY,
      token: 'trk_env',
      tokenSource: 'TRACKER_API_TOKEN',
    });
  });

  it('refuses to send a token over plain http to another computer', () => {
    const env = { TRACKER_URL: 'http://tracker.up.railway.app', TRACKER_API_TOKEN: 'trk_env' };
    expect(() => loadConfig(env)).toThrow(
      'Not sending an API token to http://tracker.up.railway.app: on plain http anyone on the network can read it.',
    );
    expect(() => loadConfig({}, { url: 'http://192.168.1.20:4100', token: 'trk_flag' })).toThrow(
      PlainHttpError,
    );
    const saved = withToken(NO_SAVED_CONFIG, 'http://192.168.1.20:4100', 'trk_old');
    expect(() => loadConfig({}, {}, saved)).toThrow(PlainHttpError);
  });

  it('still reaches a plain http tracker on this computer, or one elsewhere without a token', () => {
    expect(loadConfig({ TRACKER_API_TOKEN: 'trk_env' }).token).toBe('trk_env');
    const env = { TRACKER_URL: 'http://127.0.0.1:4662', TRACKER_TOKEN: 'old' };
    expect(loadConfig(env).token).toBe('old');
    expect(loadConfig({ TRACKER_URL: 'http://192.168.1.20:4100' })).toEqual({
      url: 'http://192.168.1.20:4100',
      token: undefined,
      agentName: 'Claude',
    });
  });
});

describe('createTrackerClient', () => {
  it('links attachment files under TRACKER_URL and knows whether it sends a token', () => {
    const config = { url: 'http://t:1/', token: 'secret', agentName: 'Claude' };
    const client = createTrackerClient(config);
    expect(client.attachmentFileUrl('a 1')).toBe('http://t:1/api/attachments/a%201/file');
    expect(client.usesToken).toBe(true);
    expect(createTrackerClient({ ...config, token: undefined }).usesToken).toBe(false);
  });

  it('knows its tracker and where its token came from, for error messages', () => {
    const client = createTrackerClient({
      url: RAILWAY,
      token: 'trk_x',
      tokenSource: 'tracker login',
      agentName: 'Claude',
    });
    expect(client).toMatchObject({ trackerUrl: RAILWAY, tokenSource: 'tracker login' });
  });

  it('talks to the configured URL as an agent', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('[]', { status: 200 }));
    try {
      const client = createTrackerClient({
        url: 'http://t:1',
        token: 'secret',
        agentName: 'Claude Bot',
      });
      expect(client).toBeInstanceOf(TrackerClient);
      await client.listProjects();
      const [url, init] = fetchSpy.mock.calls[0]!;
      const headers = new Headers(init?.headers);
      expect(url).toBe('http://t:1/api/projects');
      expect(headers.get('authorization')).toBe('Bearer secret');
      expect(headers.get('x-actor-kind')).toBe('agent');
      expect(headers.get('x-actor-name')).toBe('Claude%20Bot');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
