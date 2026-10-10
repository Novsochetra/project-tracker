import { describe, expect, it } from 'vitest';
import { requireTrackerTools } from '../../src/watch/mcp/checkTools';
import { parseMcpList } from '../../src/watch/mcp/mcpList';
import { trackerToolsProblem } from '../../src/watch/mcp/trackerTools';

const LIST = [
  'Checking MCP server health…',
  '',
  'claude.ai Gmail: https://gmailmcp.googleapis.com/mcp/v1 - ✔ Connected',
  'plugin:figma:figma: https://mcp.figma.com/mcp (HTTP) - ! Needs authentication',
  'tracker: node /gone/apps/agent/dist/mcp.js - ✗ Failed to connect',
].join('\n');

describe('what claude mcp list says', () => {
  it('reads a name with spaces or colons, the command and the state', () => {
    expect(parseMcpList(LIST)).toEqual([
      {
        name: 'claude.ai Gmail',
        detail: 'https://gmailmcp.googleapis.com/mcp/v1',
        state: '✔ Connected',
        ok: true,
      },
      {
        name: 'plugin:figma:figma',
        detail: 'https://mcp.figma.com/mcp (HTTP)',
        state: '! Needs authentication',
        ok: false,
      },
      {
        name: 'tracker',
        detail: 'node /gone/apps/agent/dist/mcp.js',
        state: '✗ Failed to connect',
        ok: false,
      },
    ]);
  });

  it('reads nothing from a list it does not understand', () => {
    expect(parseMcpList('No MCP servers configured.')).toEqual([]);
    expect(parseMcpList('')).toEqual([]);
  });
});

describe('the tracker tools check', () => {
  it('names the bad path and how to fix it', () => {
    const problem = trackerToolsProblem(parseMcpList(LIST));
    expect(problem).toContain('/gone/apps/agent/dist/mcp.js');
    expect(problem).toContain('✗ Failed to connect');
    expect(problem).toContain('claude mcp remove tracker -s user');
  });

  it('says so when there is no tracker server at all', () => {
    const problem = trackerToolsProblem(parseMcpList('other: node /other.js - ✔ Connected'));
    expect(problem).toContain('no "tracker" MCP server here');
  });

  it('is happy with a connected tracker server', () => {
    const servers = parseMcpList('tracker: node /here/mcp.js - ✔ Connected');
    expect(trackerToolsProblem(servers)).toBeUndefined();
  });

  it('refuses runs when the tracker server is broken', async () => {
    const log: string[] = [];
    await expect(
      requireTrackerTools({ listOutput: () => Promise.resolve(LIST), log: (t) => log.push(t) }),
    ).rejects.toThrow(/Refusing runs until that works\.$/);
    expect(log).toEqual([]);
  });

  it('carries on, with a word, when the list cannot be read', async () => {
    const log: string[] = [];
    await requireTrackerTools({
      listOutput: () => Promise.resolve('mcp list is not available'),
      log: (text) => log.push(text),
    });
    expect(log).toEqual([
      "Couldn't read Claude Code's MCP servers (claude mcp list), so they weren't checked.",
    ]);
  });
});
