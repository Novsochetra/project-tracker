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
// lane so it never changes the folder beside a ticket run. Without the person's own mode it asks
// before each step, as the desktop app does: the person is on the phone, and their default mode
// (often auto) would ask almost nothing. A ticket run nobody watches keeps that default.
const editArgs = (permissionMode?: string): string[] => [
  '--permission-mode',
  permissionMode ?? 'default',
];

// Plan is read-only like Ask; only its prompt differs. Anything else, an older server's missing
// mode or a name this helper doesn't know, falls back to read-only.
export function askModeArgs(mode: unknown, permissionMode?: string): string[] {
  return mode === 'edit' ? editArgs(permissionMode) : [...READ_ONLY];
}
