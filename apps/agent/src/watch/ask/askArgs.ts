const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Read-only whatever the helper was started with: plan mode, no edit tools and no MCP servers, so
// Claude can't change the folder or reach the tracker. Only the person's taps make tickets and runs.
const READ_ONLY = [
  '--permission-mode',
  'plan',
  '--strict-mcp-config',
  '--disallowedTools',
  'Edit',
  'Write',
  'NotebookEdit',
];

// The session id comes from the tracker, so only a UUID becomes an argument.
export function askArgs(resumeSessionId: string | null): string[] {
  const resume =
    resumeSessionId && SESSION_ID.test(resumeSessionId) ? ['--resume', resumeSessionId] : [];
  return ['-p', '--output-format', 'json', ...READ_ONLY, ...resume];
}

export const isSessionId = (value: unknown): value is string =>
  typeof value === 'string' && SESSION_ID.test(value);
