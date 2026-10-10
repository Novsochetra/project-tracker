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
] as const;

// Edit gets what a ticket run gets, the tracker MCP included; the server sends it to the ticket
// lane so it never changes the folder beside a ticket run.
const editArgs = (permissionMode?: string): string[] =>
  permissionMode ? ['--permission-mode', permissionMode] : [];

// Plan is read-only like Ask; only its prompt differs. Anything else, an older server's missing
// mode or a name this helper doesn't know, falls back to read-only.
export function askModeArgs(mode: unknown, permissionMode?: string): string[] {
  return mode === 'edit' ? editArgs(permissionMode) : [...READ_ONLY];
}
