import type {
  AskInput,
  CardTicketInput,
  Chat,
  ChatDetail,
  QueuedEditInput,
  StartChatInput,
} from '@tracker/shared';
import { segment } from './asking';
import { ChangesClient } from './changesClient';

const queuedPath = (chatId: string, messageId: string) =>
  `/api/chats/${segment(chatId)}/queue/${segment(messageId)}`;

// Chats and the messages sent while Claude answers (PT-234), apart from the rest so no file grows
// past its limit.
export class ChatQueueClient extends ChangesClient {
  listChats = (projectKey: string) =>
    this.http.request<Chat[]>('GET', `/api/projects/${segment(projectKey)}/chats`);

  startChat = (projectKey: string, input: StartChatInput) =>
    this.http.request<ChatDetail>('POST', `/api/projects/${segment(projectKey)}/chats`, {
      body: input,
    });

  getChat = (chatId: string) =>
    this.http.request<ChatDetail>('GET', `/api/chats/${segment(chatId)}`);

  deleteChat = (chatId: string) =>
    this.http.request<void>('DELETE', `/api/chats/${segment(chatId)}`);

  ask = (chatId: string, input: AskInput) =>
    this.http.request<ChatDetail>('POST', `/api/chats/${segment(chatId)}/messages`, {
      body: input,
    });

  createCardTicket = (chatId: string, messageId: string, input: CardTicketInput) =>
    this.http.request<ChatDetail>(
      'POST',
      `/api/chats/${segment(chatId)}/messages/${segment(messageId)}/ticket`,
      { body: input },
    );

  editQueued = (chatId: string, messageId: string, input: QueuedEditInput) =>
    this.http.request<ChatDetail>('PATCH', queuedPath(chatId, messageId), { body: input });

  removeQueued = (chatId: string, messageId: string) =>
    this.http.request<ChatDetail>('DELETE', queuedPath(chatId, messageId));

  sendQueuedNow = (chatId: string, messageId: string) =>
    this.http.request<ChatDetail>('POST', `${queuedPath(chatId, messageId)}/send`);
}
