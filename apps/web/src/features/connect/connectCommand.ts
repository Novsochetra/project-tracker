import type { ServerMeta } from '@tracker/shared';
import type { Route } from '../../navigation';

export type ConnectInfo = Pick<ServerMeta, 'serverUrl' | 'mcpEntry' | 'cliEntry'>;

export type SlashCommand = 'work' | 'review';

export const KEY_PLACEHOLDER = '<PROJECT KEY>';
export const BUILD_COMMAND = 'npm run build -w @tracker/agent';
export const COMMAND_COPIED = 'Command copied';
export const COMMAND_COPY_BLOCKED =
  'Copying was blocked here. Select the command and copy it yourself.';

const SHELL_SAFE = /^[\w@%+=:,./-]+$/;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Paths with spaces or quotes must survive being pasted into a shell as one argument.
export const shellQuote = (value: string): string =>
  SHELL_SAFE.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

function hostOf(url: string): { host: string; hostname: string } | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

// Behind a proxy that ends TLS (Railway), the server sees http and names itself so; the page knows
// the address people really use. Under `npm run dev` the page is Vite's, on another port, so the
// server's own address stands.
export function trackerAddress(serverUrl: string, pageOrigin: string): string {
  const server = hostOf(serverUrl);
  return server && server.host === hostOf(pageOrigin)?.host ? pageOrigin : serverUrl;
}

// Only a tracker on this computer runs from a checkout here, so only then are its paths the paths
// on this computer. Elsewhere (Railway) the commands run in the person's own checkout.
export const isLocalTracker = (serverUrl: string): boolean => {
  const hostname = hostOf(serverUrl)?.hostname ?? '';
  return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
};

const mcpEntry = ({ serverUrl, mcpEntry: path }: ConnectInfo): string =>
  isLocalTracker(serverUrl) ? shellQuote(path) : '"$(pwd)/apps/agent/dist/mcp.js"';

const cliEntry = ({ serverUrl, cliEntry: path }: ConnectInfo): string =>
  isLocalTracker(serverUrl) ? shellQuote(path) : 'apps/agent/dist/cli.js';

// The token isn't in the command: `tracker login` saved it where the MCP server reads it.
export function mcpAddCommand(info: ConnectInfo): string {
  return [
    'claude mcp add tracker -s user',
    `--env TRACKER_URL=${shellQuote(info.serverUrl)}`,
    '--env TRACKER_AGENT_NAME=Claude',
    `-- node ${mcpEntry(info)}`,
  ].join(' ');
}

export const loginCommand = (info: ConnectInfo): string =>
  `node ${cliEntry(info)} login --url ${shellQuote(info.serverUrl)}`;

export const cliHelpCommand = (info: ConnectInfo): string => `node ${cliEntry(info)} help`;

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
