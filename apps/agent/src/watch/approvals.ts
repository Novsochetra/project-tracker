import type { WatchArgs } from './watchIo';

// Claude Code never calls the prompt tool in these, so the phone would never be asked.
const NEVER_ASKS: ReadonlySet<string> = new Set(['bypassPermissions', 'dontAsk']);

export function approvalsProblem({ approvals, permissionMode }: WatchArgs): string | undefined {
  if (!approvals || !permissionMode || !NEVER_ASKS.has(permissionMode)) return undefined;
  return `--approvals asks on the phone, but --permission-mode ${permissionMode} never asks. Use acceptEdits.`;
}

// Without --approvals a ticket run keeps Claude Code's own settings (often auto, which asks almost
// nothing); with it, every step outside the allow rules waits on the phone, as in an Edit question.
export const runPermissionMode = ({ approvals, permissionMode }: WatchArgs): string | undefined =>
  permissionMode ?? (approvals ? 'default' : undefined);
