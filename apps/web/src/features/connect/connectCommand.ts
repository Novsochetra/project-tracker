import type { ServerMeta } from '@tracker/shared';
import type { Route } from '../../navigation';

export type ConnectInfo = Pick<ServerMeta, 'serverUrl' | 'mcpEntry' | 'authRequired'>;

export type SlashCommand = 'work' | 'review';

export const TOKEN_PLACEHOLDER = '<your token>';
export const KEY_PLACEHOLDER = '<PROJECT KEY>';
export const BUILD_COMMAND = 'npm run build -w @tracker/agent';
export const COMMAND_COPIED = 'Command copied';
export const COMMAND_COPY_BLOCKED =
  'Copying was blocked here. Select the command and copy it yourself.';

const SHELL_SAFE = /^[\w@%+=:,./-]+$/;

// Paths with spaces or quotes must survive being pasted into a shell as one argument.
export const shellQuote = (value: string): string =>
  SHELL_SAFE.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

export function mcpAddCommand({ serverUrl, mcpEntry, authRequired }: ConnectInfo): string {
  const env = [`TRACKER_URL=${serverUrl}`, 'TRACKER_AGENT_NAME=Claude'];
  if (authRequired) env.push(`TRACKER_TOKEN=${TOKEN_PLACEHOLDER}`);
  return [
    'claude mcp add tracker -s user',
    ...env.map((value) => `--env ${value}`),
    `-- node ${shellQuote(mcpEntry)}`,
  ].join(' ');
}

export const cliHelpCommand = (cliEntry: string): string => `node ${shellQuote(cliEntry)} help`;

export const slashCommand = (name: SlashCommand, projectKey: string | null): string =>
  `/mcp__tracker__${name} ${projectKey ?? KEY_PLACEHOLDER}`;

// The sheet opens from a project's options, so the screen behind it names the project.
export const routeProjectKey = (route: Route | undefined): string | null =>
  route && route.name !== 'projects' ? route.key.toUpperCase() : null;

const LEAVE_KEY_OUT = 'Leave it out and the agent finds the project by its repository.';

export const projectKeyNote = (projectKey: string | null): string =>
  projectKey
    ? `${projectKey} is this project’s key. ${LEAVE_KEY_OUT}`
    : `Use the project’s key, like MOB. ${LEAVE_KEY_OUT}`;
