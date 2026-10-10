import { resolveStatus, type Status, type TicketDetail } from '@tracker/shared';

export const PROMPT_HELP =
  'Paste this into Claude Code. It asks Claude to end with a short report you can bring back here with Paste report. You can edit the text first.';
export const RUN_PROMPT_HELP =
  'Run this in Claude Code on your computer, or copy it into Claude Code yourself. You can edit the text first.';
export const NO_OPEN_TICKETS = 'There are no open tickets in this project.';
export const COPY_BLOCKED = 'Copying was blocked here. Select the text above and copy it yourself.';
export const PROMPT_COPIED = 'Prompt copied';
export const COPIED_MS = 2000;

export function promptHelp(hasPrompt: boolean, offersRun: boolean): string {
  if (!hasPrompt) return NO_OPEN_TICKETS;
  return offersRun ? RUN_PROMPT_HELP : PROMPT_HELP;
}

export const openTicketsLabel = (count: number): string =>
  `${count} open ticket${count === 1 ? '' : 's'}`;

export const joinSubtitle = (...parts: readonly (string | undefined)[]): string =>
  parts.filter((part) => part).join(' · ');

// The status "Send" would move the ticket to: only from a To do status, and only when the
// project has an In progress status (resolveStatus falls back to To do otherwise).
export function sendTarget(detail: TicketDetail | undefined): Status | null {
  if (!detail || detail.status.category !== 'todo') return null;
  const target = resolveStatus(detail.statuses, 'in_progress');
  return target.category === 'in_progress' ? target : null;
}

export const switchLabel = (ticketKey: string, target: Pick<Status, 'name'>): string =>
  `Move ${ticketKey} to ${target.name}`;

export const showsSwitch = (target: Status | null, sent: boolean): boolean =>
  target !== null && !sent;

export const movesOnSend = (target: Status | null, switchOn: boolean): boolean =>
  target !== null && switchOn;

export type CopyOutcome = 'copied' | 'failed';

export interface CopyFlow {
  copy: () => Promise<boolean>;
  notify: (message: string) => void;
  markSent: () => void;
}

export async function copyPromptFlow({ copy, notify, markSent }: CopyFlow): Promise<CopyOutcome> {
  if (!(await copy())) return 'failed';
  notify(PROMPT_COPIED);
  markSent();
  return 'copied';
}

export interface ShareFlow {
  share: () => Promise<boolean>;
  markSent: () => void;
}

export async function sharePromptFlow({ share, markSent }: ShareFlow): Promise<boolean> {
  const shared = await share();
  if (shared) markSent();
  return shared;
}
