import type { ChatDetail, QueuedEditInput } from '@tracker/shared';
import { segment } from './asking';
import { ChangesClient } from './changesClient';

const queuedPath = (chatId: string, messageId: string) =>
  `/api/chats/${segment(chatId)}/queue/${segment(messageId)}`;

// Messages sent while Claude answers (PT-234), apart from the rest so no file grows past its limit.
export class ChatQueueClient extends ChangesClient {
  editQueued = (chatId: string, messageId: string, input: QueuedEditInput) =>
    this.http.request<ChatDetail>('PATCH', queuedPath(chatId, messageId), { body: input });

  removeQueued = (chatId: string, messageId: string) =>
    this.http.request<ChatDetail>('DELETE', queuedPath(chatId, messageId));

  sendQueuedNow = (chatId: string, messageId: string) =>
    this.http.request<ChatDetail>('POST', `${queuedPath(chatId, messageId)}/send`);
}
