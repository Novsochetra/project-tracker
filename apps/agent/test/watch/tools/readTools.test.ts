import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RUNNER_TOOL_NAME_MAX, RUNNER_TOOLS_MAX } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { parseMcpList } from '../../../src/watch/mcp/mcpList';
import { boundNames } from '../../../src/watch/tools/boundNames';
import { readTools } from '../../../src/watch/tools/readTools';
import { connectedServerNames } from '../../../src/watch/tools/serverNames';

const LIST = [
  'Checking MCP server health…',
  '',
  'claude.ai Gmail: https://gmailmcp.googleapis.com/mcp/v1 - ✔ Connected',
  'plugin:figma:figma: https://mcp.figma.com/mcp (HTTP) - ✔ Connected',
  'plugin:linear:linear: https://mcp.linear.app/mcp (HTTP) - ! Needs authentication',
  'github: npx -y @modelcontextprotocol/server-github --token ghp_secret - ✔ Connected',
  'tracker: node /here/apps/agent/dist/mcp.js - ✔ Connected',
].join('\n');

function folderWith(files: Record<string, string>): string {
  const folder = mkdtempSync(join(tmpdir(), 'tools-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(folder, path, '..'), { recursive: true });
    writeFileSync(join(folder, path), text);
  }
  return folder;
}

describe('the servers a helper names', () => {
  it('names connected servers only, as the person knows them, without the tracker', () => {
    expect(connectedServerNames(parseMcpList(LIST))).toEqual(['Gmail', 'figma', 'github']);
  });

  it('never sends a command, address or argument', async () => {
    const tools = await readTools(LIST, folderWith({}));
    expect(JSON.stringify(tools)).not.toMatch(/secret|https|npx|node/);
  });
});

describe("the folder's commands and skills", () => {
  it('names each command file and each skill with a SKILL.md, in order', async () => {
    const folder = folderWith({
      '.claude/commands/weekly-report.md': '# Report',
      '.claude/commands/standup.md': '# Standup',
      '.claude/commands/notes.txt': 'not a command',
      '.claude/skills/drafting/SKILL.md': '---\nname: drafting\n---',
      '.claude/skills/half-made/README.md': 'no skill here',
    });
    expect(await readTools(LIST, folder)).toEqual({
      servers: ['Gmail', 'figma', 'github'],
      commands: ['standup', 'weekly-report'],
      skills: ['drafting'],
    });
  });

  it('has none in a folder without .claude, and no servers from a list it cannot read', async () => {
    expect(await readTools('mcp list is not available', folderWith({}))).toEqual({
      servers: null,
      commands: [],
      skills: [],
    });
  });
});

describe('the bounds a helper keeps', () => {
  it('drops empty, repeated and too long names, and cuts the list at its bound', () => {
    const long = 'x'.repeat(RUNNER_TOOL_NAME_MAX + 1);
    expect(boundNames([' a ', '', 'a', long, 'b'])).toEqual(['a', 'b']);
    const many = Array.from({ length: RUNNER_TOOLS_MAX + 5 }, (_, index) => `s${index}`);
    expect(boundNames(many)).toEqual(many.slice(0, RUNNER_TOOLS_MAX));
  });
});
