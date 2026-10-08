import { describe, expect, it } from 'vitest';
import {
  cliHelpCommand,
  mcpAddCommand,
  REVIEW_COMMAND,
  shellQuote,
  WORK_COMMAND,
} from './connectCommand';

const MCP = '/Users/dara/code/project-tracker/apps/agent/dist/mcp.js';

describe('mcpAddCommand', () => {
  it('registers the MCP server for every project with this tracker’s URL', () => {
    expect(
      mcpAddCommand({ origin: 'http://localhost:5173', mcpEntry: MCP, authRequired: false }),
    ).toBe(
      `claude mcp add tracker -s user --env TRACKER_URL=http://localhost:5173 --env TRACKER_AGENT_NAME=Claude -- node ${MCP}`,
    );
  });

  it('adds a token placeholder when the tracker needs one', () => {
    expect(
      mcpAddCommand({ origin: 'https://tracker.lan', mcpEntry: MCP, authRequired: true }),
    ).toBe(
      `claude mcp add tracker -s user --env TRACKER_URL=https://tracker.lan --env TRACKER_AGENT_NAME=Claude --env TRACKER_TOKEN=<your token> -- node ${MCP}`,
    );
  });

  it('quotes an entry path with spaces', () => {
    const command = mcpAddCommand({
      origin: 'http://localhost:4100',
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

describe('other commands', () => {
  it('shows the CLI help and the two slash commands', () => {
    expect(cliHelpCommand('/repo/apps/agent/dist/cli.js')).toBe(
      'node /repo/apps/agent/dist/cli.js help',
    );
    expect(WORK_COMMAND).toBe('/mcp__tracker__work <PROJECT KEY>');
    expect(REVIEW_COMMAND).toBe('/mcp__tracker__review <PROJECT KEY>');
  });
});
