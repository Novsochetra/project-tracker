import type { McpServer } from './mcpList';

export const TRACKER_MCP = 'tracker';

const ADD = 'see Connect Claude Code in the app for the "claude mcp add tracker" command';

// Without the tracker MCP, Claude Code can claim nothing, comment nothing and submit nothing: it
// does the work and the ticket stays as it was (PT-155).
export function trackerToolsProblem(
  servers: readonly McpServer[],
  name = TRACKER_MCP,
): string | undefined {
  const server = servers.find((candidate) => candidate.name === name);
  if (!server) {
    return `Claude Code has no "${name}" MCP server here, so it would have no tracker tools: ${ADD}.`;
  }
  if (server.ok) return undefined;
  return (
    `Claude Code can't start the "${name}" MCP server (${server.state}), so it would have no ` +
    `tracker tools: ${server.detail}. Check that file exists (npm run build makes it), or ` +
    `"claude mcp remove ${name} -s user" and add it again — ${ADD}.`
  );
}
