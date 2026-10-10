import { parseMcpList } from './mcpList';
import { trackerToolsProblem } from './trackerTools';

export class TrackerToolsError extends Error {
  override name = 'TrackerToolsError';
}

export interface ToolsCheck {
  listOutput: () => Promise<string>;
  log: (text: string) => void;
}

// A list we can't read (an older Claude Code, a changed format) must not stop a helper that works,
// so only a list that names its servers can refuse the runs.
export async function requireTrackerTools({ listOutput, log }: ToolsCheck): Promise<void> {
  const servers = parseMcpList(await listOutput());
  if (servers.length === 0) {
    log("Couldn't read Claude Code's MCP servers (claude mcp list), so they weren't checked.");
    return;
  }
  const problem = trackerToolsProblem(servers);
  if (problem) throw new TrackerToolsError(`${problem} Refusing runs until that works.`);
}
