export interface ConnectInfo {
  origin: string;
  mcpEntry: string;
  authRequired: boolean;
}

export const TOKEN_PLACEHOLDER = '<your token>';
export const BUILD_COMMAND = 'npm run build -w @tracker/agent';
export const WORK_COMMAND = '/mcp__tracker__work <PROJECT KEY>';
export const REVIEW_COMMAND = '/mcp__tracker__review <PROJECT KEY>';
export const COMMAND_COPIED = 'Command copied';
export const COMMAND_COPY_BLOCKED =
  'Copying was blocked here. Select the command and copy it yourself.';

const SHELL_SAFE = /^[\w@%+=:,./-]+$/;

// Paths with spaces or quotes must survive being pasted into a shell as one argument.
export const shellQuote = (value: string): string =>
  SHELL_SAFE.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

export function mcpAddCommand({ origin, mcpEntry, authRequired }: ConnectInfo): string {
  const env = [`TRACKER_URL=${origin}`, 'TRACKER_AGENT_NAME=Claude'];
  if (authRequired) env.push(`TRACKER_TOKEN=${TOKEN_PLACEHOLDER}`);
  return [
    'claude mcp add tracker -s user',
    ...env.map((value) => `--env ${value}`),
    `-- node ${shellQuote(mcpEntry)}`,
  ].join(' ');
}

export const cliHelpCommand = (cliEntry: string): string => `node ${shellQuote(cliEntry)} help`;
