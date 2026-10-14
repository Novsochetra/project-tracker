import type { QueuedMessage } from '@tracker/shared';
import { QueuedItem } from './QueuedItem';

export interface QueuedMessagesProps {
  chatId: string;
  queued: readonly QueuedMessage[];
  waits: boolean;
}

export function QueuedMessages({ chatId, queued, waits }: QueuedMessagesProps) {
  return queued.map((message) => (
    <QueuedItem key={message.id} chatId={chatId} message={message} waits={waits} />
  ));
}
