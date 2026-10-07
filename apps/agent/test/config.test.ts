import { TrackerClient } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { createTrackerClient } from '../src/client';
import { DEFAULT_AGENT_NAME, DEFAULT_URL, loadConfig } from '../src/config';

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

  it('reads TRACKER_URL, TRACKER_TOKEN and TRACKER_AGENT_NAME', () => {
    const env = {
      TRACKER_URL: 'http://t:1',
      TRACKER_TOKEN: 'secret',
      TRACKER_AGENT_NAME: 'Reviewer',
    };
    expect(loadConfig(env)).toEqual({ url: 'http://t:1', token: 'secret', agentName: 'Reviewer' });
  });

  it('prefers overrides and ignores blank values', () => {
    const env = { TRACKER_URL: '  ', TRACKER_AGENT_NAME: 'Worker' };
    expect(loadConfig(env, { as: ' Bot ', token: '' })).toEqual({
      url: DEFAULT_URL,
      token: undefined,
      agentName: 'Bot',
    });
  });
});

describe('createTrackerClient', () => {
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
