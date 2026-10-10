import { describe, expect, it } from 'vitest';
import {
  cliHelpCommand,
  isLocalTracker,
  loginCommand,
  mcpAddCommand,
  projectKeyNote,
  routeProjectKey,
  shellQuote,
  slashCommand,
  trackerAddress,
  watchCommand,
} from './connectCommand';

const MCP = '/Users/dara/code/project-tracker/apps/agent/dist/mcp.js';
const CLI = '/Users/dara/code/project-tracker/apps/agent/dist/cli.js';
const local = { serverUrl: 'http://localhost:4100', mcpEntry: MCP, cliEntry: CLI };
const RAILWAY = 'https://tracker.up.railway.app';
const online = { serverUrl: RAILWAY, mcpEntry: '/app/apps/agent/dist/mcp.js', cliEntry: '/app/x' };

describe('mcpAddCommand', () => {
  it('registers the MCP server on this computer for every project with the server’s URL', () => {
    expect(mcpAddCommand(local)).toBe(
      `claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node ${MCP}`,
    );
  });

  it('points at the person’s own checkout for a tracker elsewhere, with no token in it', () => {
    expect(mcpAddCommand(online)).toBe(
      `claude mcp add tracker -s user --env TRACKER_URL=${RAILWAY} --env TRACKER_AGENT_NAME=Claude -- node "$(pwd)/apps/agent/dist/mcp.js"`,
    );
  });

  it('quotes an entry path with spaces', () => {
    const command = mcpAddCommand({ ...local, mcpEntry: '/Users/dara/My Code/mcp.js' });
    expect(command.endsWith("-- node '/Users/dara/My Code/mcp.js'")).toBe(true);
  });
});

describe('loginCommand', () => {
  it('saves a token for this tracker with the CLI', () => {
    expect(loginCommand(local)).toBe(`node ${CLI} login --url http://localhost:4100`);
    expect(loginCommand(online)).toBe(`node apps/agent/dist/cli.js login --url ${RAILWAY}`);
  });
});

describe('cliHelpCommand', () => {
  it('runs the CLI’s help', () => {
    expect(cliHelpCommand(local)).toBe(`node ${CLI} help`);
    expect(cliHelpCommand(online)).toBe('node apps/agent/dist/cli.js help');
  });
});

describe('watchCommand', () => {
  it('starts the helper for the project behind the sheet with the CLI on this computer', () => {
    expect(watchCommand(local, 'MOB')).toBe(`node ${CLI} watch MOB`);
    expect(watchCommand({ ...local, cliEntry: '/Users/dara/My Code/cli.js' }, 'MOB')).toBe(
      "node '/Users/dara/My Code/cli.js' watch MOB",
    );
  });

  it('leaves the key out without a project, so the helper finds it by its folder', () => {
    expect(watchCommand(local, null)).toBe(`node ${CLI} watch`);
  });

  it('asks for the person’s own checkout for a tracker elsewhere, since it runs in another folder', () => {
    expect(watchCommand(online, 'MOB')).toBe(
      'node /absolute/path/to/project-tracker/apps/agent/dist/cli.js watch MOB',
    );
  });
});

describe('trackerAddress', () => {
  it('takes the page’s address when the server names the same host behind a TLS proxy', () => {
    expect(trackerAddress('http://tracker.up.railway.app', RAILWAY)).toBe(RAILWAY);
  });

  it('keeps the server’s address under the dev server, which is on another port', () => {
    expect(trackerAddress('http://localhost:4100', 'http://localhost:5173')).toBe(
      'http://localhost:4100',
    );
    expect(trackerAddress('https://t.ts.net', 'http://192.168.1.4:5173')).toBe('https://t.ts.net');
  });
});

describe('isLocalTracker', () => {
  it('knows a tracker on this computer', () => {
    expect(isLocalTracker('http://localhost:4100')).toBe(true);
    expect(isLocalTracker('http://127.0.0.1:4100')).toBe(true);
    expect(isLocalTracker('http://[::1]:4100')).toBe(true);
    expect(isLocalTracker('http://tracker.localhost')).toBe(true);
    expect(isLocalTracker(RAILWAY)).toBe(false);
    expect(isLocalTracker('http://192.168.1.4:4100')).toBe(false);
    expect(isLocalTracker('not a url')).toBe(false);
  });
});

describe('shellQuote', () => {
  it('leaves plain paths alone and quotes the rest safely', () => {
    expect(shellQuote('/a/b-c_d.js')).toBe('/a/b-c_d.js');
    expect(shellQuote('C:\\x y')).toBe("'C:\\x y'");
    expect(shellQuote("/it's/here")).toBe("'/it'\\''s/here'");
  });
});

describe('slash commands', () => {
  it('names the project’s key, or a placeholder without a project', () => {
    expect(slashCommand('work', 'MOB')).toBe('/mcp__tracker__work MOB');
    expect(slashCommand('review', 'MOB')).toBe('/mcp__tracker__review MOB');
    expect(slashCommand('work', null)).toBe('/mcp__tracker__work <PROJECT KEY>');
  });

  it('takes the key from the project or ticket screen behind the sheet', () => {
    expect(routeProjectKey({ name: 'project', key: 'mob' })).toBe('MOB');
    expect(routeProjectKey({ name: 'ticket', key: 'WEB', num: 3 })).toBe('WEB');
    expect(routeProjectKey({ name: 'projects' })).toBeNull();
    expect(routeProjectKey(undefined)).toBeNull();
  });

  it('explains the key', () => {
    expect(projectKeyNote('MOB')).toBe(
      'MOB is this project’s key. Leave it out and the agent finds the project by its repository.',
    );
    expect(projectKeyNote(null)).toBe(
      'Use the project’s key, like MOB. Leave it out and the agent finds the project by its repository.',
    );
  });
});
