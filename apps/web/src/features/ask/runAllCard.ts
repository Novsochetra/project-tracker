import {
  ENDED_RUN_STATUSES,
  splitRunAllCard,
  type BatchTicket,
  type BatchTicketState,
  type ChatMessage,
  type RunAllCardSplit,
  type RunAllPreview,
  type RunStatus,
} from '@tracker/shared';

export const RUN_ALL_TITLE = 'Run all To do';
export const NO_HELPER_HINT = 'Start tracker watch on a computer for this project.';
export const NOTHING_TO_RUN = 'No To do tickets to run.';

export interface RunAllMessageCard {
  split: RunAllCardSplit;
  // Claude sent a newer Run all card after this one, and this one was never confirmed.
  replaced: boolean;
}

// Only Claude writes cards; a person's message that quotes one stays text.
export function messageRunAllCards(
  messages: readonly ChatMessage[],
): Map<string, RunAllMessageCard> {
  const splits = messages.flatMap((message) => {
    const split = message.role === 'claude' ? splitRunAllCard(message.text) : null;
    return split ? [{ message, split }] : [];
  });
  const latest = splits.at(-1)?.message.id;
  return new Map(
    splits.map(({ message, split }) => [
      message.id,
      { split, replaced: message.id !== latest && message.batchRunId === null },
    ]),
  );
}

export const limitText = (cardLimit: number | null) =>
  cardLimit === null ? 'Claude decides how many at a time' : `${cardLimit} at a time`;

export function skippedLines({ skippedActive, skippedDevice, leftOver }: RunAllPreview): string[] {
  return [
    skippedActive > 0 ? `${skippedActive} already running or waiting` : '',
    skippedDevice > 0 ? `${skippedDevice} ${skippedDevice === 1 ? 'needs' : 'need'} a device` : '',
    leftOver > 0 ? `${leftOver} more wait for the next Run all` : '',
  ].filter(Boolean);
}

const COUNTED: readonly BatchTicketState[] = ['running', 'waiting', 'done', 'failed'];

export function batchCountsText(tickets: readonly BatchTicket[]): string {
  const count = (state: BatchTicketState) => tickets.filter((t) => t.state === state).length;
  const cancelled = count('cancelled');
  const parts = COUNTED.map((state) => `${count(state)} ${state}`);
  return [...parts, ...(cancelled > 0 ? [`${cancelled} cancelled`] : [])].join(' · ');
}

const isEnded = (status: RunStatus): boolean =>
  (ENDED_RUN_STATUSES as readonly RunStatus[]).includes(status);

export const batchEndText = (status: RunStatus): string | null => {
  if (!isEnded(status)) return null;
  if (status === 'done') return 'Finished';
  return status === 'cancelled' ? 'Stopped' : 'Failed';
};

export const STATE_LABELS: Record<BatchTicketState, string> = {
  waiting: 'Waiting',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
