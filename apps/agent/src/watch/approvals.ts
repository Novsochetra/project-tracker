import type { WatchArgs } from './watchIo';

// Claude Code never calls the prompt tool in bypassPermissions or dontAsk, and in auto its
// classifier decides most steps itself, so the phone wouldn't be asked before each step.
const ASKS_NO_ONE: ReadonlySet<string> = new Set(['auto', 'bypassPermissions', 'dontAsk']);

export function approvalsProblem({ approvals, permissionMode }: WatchArgs): string | undefined {
  if (!approvals || !permissionMode || !ASKS_NO_ONE.has(permissionMode)) return undefined;
  return `--approvals asks on the phone before each step, but --permission-mode ${permissionMode} doesn't. Use acceptEdits.`;
}

// Without --approvals a ticket run keeps Claude Code's own settings (often auto, which asks almost
// nothing); with it, every step outside the allow rules waits on the phone, as in an Edit question.
export const runPermissionMode = ({ approvals, permissionMode }: WatchArgs): string | undefined =>
  permissionMode ?? (approvals ? 'default' : undefined);
