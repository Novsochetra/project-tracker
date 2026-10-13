import type { RunnerTools } from '@tracker/shared';
import { parseMcpList } from '../mcp/mcpList';
import { boundNames } from './boundNames';
import { commandNames, skillNames } from './folderTools';
import { connectedServerNames } from './serverNames';

// Servers are null when the list couldn't be read: it always names the tracker's at least.
export type FoundTools = Omit<RunnerTools, 'servers'> & { servers: string[] | null };

export async function readTools(listText: string, folder: string): Promise<FoundTools> {
  const servers = parseMcpList(listText);
  const [commands, skills] = await Promise.all([commandNames(folder), skillNames(folder)]);
  return {
    servers: servers.length === 0 ? null : boundNames(connectedServerNames(servers)),
    commands: boundNames(commands),
    skills: boundNames(skills),
  };
}
