import { screen, within } from '@testing-library/react';
import type { ServerMeta } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithApi, sheetTestSetup } from '../../src/features/claude/test/renderWithApi';
import { ConnectSheet } from '../../src/features/connect/ConnectSheet';

// Reviewer 100 (PT-138): opened at a plain-http LAN address (HOST=0.0.0.0, http://192.168.x:4100),
// the sheet showed login and MCP commands for that address, which the CLI refuses since PT-132.
const meta: ServerMeta = {
  version: '1.0.0',
  commit: null,
  serverUrl: 'http://192.168.1.20:4100',
  repoRoot: '/repo',
  mcpEntry: '/repo/apps/agent/dist/mcp.js',
  cliEntry: '/repo/apps/agent/dist/cli.js',
  authRequired: true,
};

const sheet = () => screen.getByRole('dialog', { name: 'Connect Claude Code' });

let restore: () => void;

beforeEach(() => {
  restore = sheetTestSetup();
});

afterEach(() => restore());

describe('regression: Connect Claude Code at a plain-http LAN address', () => {
  it('gives the commands for localhost on the tracker’s computer and says why', async () => {
    renderWithApi(<ConnectSheet open onClose={() => undefined} />, {
      getMeta: vi.fn().mockResolvedValue(meta),
      listApiTokens: vi.fn().mockResolvedValue([]),
    });
    expect(
      await within(sheet()).findByText(`node ${meta.cliEntry} login --url http://localhost:4100`),
    ).toBeInTheDocument();
    expect(
      within(sheet()).getByText(
        `claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node ${meta.mcpEntry}`,
      ),
    ).toBeInTheDocument();
    expect(within(sheet()).getByText('http://localhost:4100')).toBeInTheDocument();
    expect(
      within(sheet()).getByText(
        'Agents on the tracker’s computer reach it here. On other computers they need its https address: plain http would show their token to the network.',
      ),
    ).toBeInTheDocument();
    expect(within(sheet()).queryByText(/192\.168\.1\.20/)).not.toBeInTheDocument();
  });
});
