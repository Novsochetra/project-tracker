import type { McpServer } from '../mcp/mcpList';
import { TRACKER_MCP } from '../mcp/trackerTools';

const CONNECTOR = 'claude.ai ';
const PLUGIN = 'plugin:';

// "claude.ai Gmail" is a claude.ai connector and "plugin:figma:figma" a plugin's server; the
// person knows them as Gmail and figma.
export function shownName(name: string): string {
  if (name.startsWith(CONNECTOR)) return name.slice(CONNECTOR.length);
  if (name.startsWith(PLUGIN)) return name.slice(name.lastIndexOf(':') + 1);
  return name;
}

// Every run has the tracker's own tools, so naming them tells the person nothing.
export const connectedServerNames = (servers: readonly McpServer[]): string[] =>
  servers
    .filter((server) => server.ok && server.name !== TRACKER_MCP)
    .map((server) => shownName(server.name));
