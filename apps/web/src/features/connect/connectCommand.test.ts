import { describe, expect, it } from 'vitest';
import {
  cliHelpCommand,
  mcpAddCommand,
  projectKeyNote,
  routeProjectKey,
  shellQuote,
  slashCommand,
} from './connectCommand';

const MCP = '/Users/dara/code/project-tracker/apps/agent/dist/mcp.js';

describe('mcpAddCommand', () => {
  it('registers the MCP server for every project with the server’s URL', () => {
    expect(
      mcpAddCommand({ serverUrl: 'http://localhost:4100', mcpEntry: MCP, authRequired: false }),
    ).toBe(
      `claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node ${MCP}`,
    );
  });

  it('adds a token placeholder when the tracker needs one', () => {
    expect(
      mcpAddCommand({ serverUrl: 'https://tracker.lan', mcpEntry: MCP, authRequired: true }),
    ).toBe(
      `claude mcp add tracker -s user --env TRACKER_URL=https://tracker.lan --env TRACKER_AGENT_NAME=Claude --env TRACKER_TOKEN=<your token> -- node ${MCP}`,
    );
  });

  it('quotes an entry path with spaces', () => {
    const command = mcpAddCommand({
      serverUrl: 'http://localhost:4100',
      mcpEntry: '/Users/dara/My Code/mcp.js',
      authRequired: false,
    });
    expect(command.endsWith("-- node '/Users/dara/My Code/mcp.js'")).toBe(true);
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

describe('cliHelpCommand', () => {
  it('runs the CLI’s help', () => {
    expect(cliHelpCommand('/repo/apps/agent/dist/cli.js')).toBe(
      'node /repo/apps/agent/dist/cli.js help',
    );
  });
});
