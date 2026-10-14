import type { ChatGitAction } from '@tracker/shared';

export type NoteTone = 'busy' | 'done' | 'failed';

export interface ActionNote {
  tone: NoteTone;
  text: string;
  url?: string | undefined;
}

const WHAT = { commit: 'commit', pull_request: 'pull request' } as const;

function doneText({ kind, result }: ChatGitAction): string {
  if (kind === 'pull_request') return 'Opened the pull request.';
  const sha = result?.sha?.slice(0, 7);
  const on = result?.branch ? ` on ${result.branch}` : '';
  return sha ? `Committed ${sha}${on}.` : `Committed${on}.`;
}

// What the latest commit or pull request is doing, for the top of the changes.
export function actionNote(action: ChatGitAction | null): ActionNote | null {
  if (!action) return null;
  if (action.status === 'queued') {
    return { tone: 'busy', text: `Waiting for your computer to start the ${WHAT[action.kind]}…` };
  }
  if (action.status === 'running') {
    const text = action.kind === 'commit' ? 'Committing…' : 'Pushing and opening the pull request…';
    return { tone: 'busy', text };
  }
  if (action.status === 'failed') {
    return { tone: 'failed', text: action.error ?? `The ${WHAT[action.kind]} failed.` };
  }
  return { tone: 'done', text: doneText(action), url: action.result?.url };
}

export const isGoing = (action: ChatGitAction | null): boolean =>
  action?.status === 'queued' || action?.status === 'running';
