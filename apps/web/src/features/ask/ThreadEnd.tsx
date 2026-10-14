import type { ChatDetail } from '@tracker/shared';
import { QueuedMessages } from './queue/QueuedMessages';
import type { useWorkingMessage } from './useWorkingMessage';
import { WorkingMessage } from './WorkingMessage';

export interface ThreadEndProps {
  chatId: string;
  detail: ChatDetail | null;
  live: Pick<ReturnType<typeof useWorkingMessage>, 'rows' | 'requests'>;
  waits: boolean;
}

// What Claude is doing now, then the messages sent meanwhile that wait for their turn.
export function ThreadEnd({ chatId, detail, live: { rows, requests }, waits }: ThreadEndProps) {
  // A request that comes before any step shows the working message too.
  const working = rows.length > 0 || requests.shown.length > 0;
  return (
    <>
      {detail?.run && working && (
        <WorkingMessage runId={detail.run.id} rows={rows} requests={requests} />
      )}
      <QueuedMessages chatId={chatId} queued={detail?.queued ?? []} waits={waits} />
    </>
  );
}
