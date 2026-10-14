import type {
  AddChatChangesInput,
  ChatChangesAnswer,
  ChatCommitInput,
  ChatPullRequestInput,
  FinishGitActionInput,
  GitActionJob,
} from '@tracker/shared';
import { segment } from './asking';
import { RunsClient } from './runsClient';

// A chat's code changes, its commits and pull requests (PT-237).
export class ChatChangesClient extends RunsClient {
  addChatChanges = (
    runId: string,
    input: AddChatChangesInput,
    { signal }: { signal?: AbortSignal } = {},
  ) =>
    this.http.request<void>('POST', `/api/runs/${segment(runId)}/chat-changes`, {
      body: input,
      signal,
    });

  getChatChanges = (chatId: string) =>
    this.http.request<ChatChangesAnswer>('GET', `/api/chats/${segment(chatId)}/changes`);

  commitChat = (chatId: string, input: ChatCommitInput) =>
    this.http.request<ChatChangesAnswer>('POST', `/api/chats/${segment(chatId)}/changes/commit`, {
      body: input,
    });

  openChatPullRequest = (chatId: string, input: ChatPullRequestInput) =>
    this.http.request<ChatChangesAnswer>(
      'POST',
      `/api/chats/${segment(chatId)}/changes/pull-request`,
      { body: input },
    );

  takeGitAction = (runnerId: string) =>
    this.http.request<GitActionJob | null>(
      'POST',
      `/api/runners/${segment(runnerId)}/git-actions/next`,
      { allowEmpty: true },
    );

  finishGitAction = (actionId: string, input: FinishGitActionInput) =>
    this.http.request<void>('POST', `/api/git-actions/${segment(actionId)}/finish`, {
      body: input,
    });
}
