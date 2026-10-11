import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { AskInput, CardTicketInput, Chat, ChatDetail, Run } from '@tracker/shared';
import { useApi } from '../context';
import { isNotFound } from '../errors';
import { queryKeys } from '../queryKeys';
import type { TrackerMutation, TrackerQuery } from '../types';
import { isWorking, WORKING_RUN_REFRESH_MS } from '../workingRun';
import { invalidateRuns, showRun } from './runs';

export interface StartChatVariables {
  projectKey: string;
  input: AskInput;
}

export interface AskVariables {
  chatId: string;
  input: AskInput;
}

export interface CardTicketVariables {
  chatId: string;
  messageId: string;
  input: CardTicketInput;
}

export interface DeleteChatVariables {
  projectKey: string;
  chatId: string;
}

export interface RunCardTicketVariables {
  ticketKey: string;
  runnerId: string;
}

// The tracker ends an ask whose helper went silent only when it is asked about the chat.
export const chatRefreshMs = (detail: ChatDetail | undefined): number | false =>
  detail?.run && isWorking(detail.run) ? WORKING_RUN_REFRESH_MS : false;

export function useChats(projectKey: string): TrackerQuery<Chat[]> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.chats(projectKey),
    queryFn: () => client.listChats(projectKey),
  });
}

export function useChat(chatId: string | null): TrackerQuery<ChatDetail> {
  const client = useApi();
  return useQuery({
    queryKey: queryKeys.chat(chatId ?? ''),
    queryFn: () => client.getChat(chatId ?? ''),
    enabled: chatId !== null,
    refetchInterval: (query) => chatRefreshMs(query.state.data),
  });
}

function showChat(queryClient: QueryClient, detail: ChatDetail): void {
  queryClient.setQueryData(queryKeys.chat(detail.chat.id), detail);
  void queryClient.invalidateQueries({ queryKey: queryKeys.chats(detail.chat.projectKey) });
}

const refreshChat = (queryClient: QueryClient, chatId: string) =>
  void queryClient.invalidateQueries({ queryKey: queryKeys.chat(chatId), exact: true });

export function useStartChat(): TrackerMutation<ChatDetail, StartChatVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectKey, input }: StartChatVariables) => client.startChat(projectKey, input),
    onSuccess: (detail) => showChat(queryClient, detail),
  });
}

export function useAsk(): TrackerMutation<ChatDetail, AskVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, input }: AskVariables) => client.ask(chatId, input),
    onSuccess: (detail) => showChat(queryClient, detail),
    // A 409 means an ask started elsewhere, which the chat should show now.
    onSettled: (_detail, _error, { chatId }) => refreshChat(queryClient, chatId),
  });
}

export function useCancelAsk(): TrackerMutation<Run, Run> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (run: Run) => client.cancelRun(run.id),
    onSuccess: (run) => {
      if (!run.chatId) return;
      queryClient.setQueryData<ChatDetail>(queryKeys.chat(run.chatId), (detail) =>
        detail ? { ...detail, run } : detail,
      );
    },
    onSettled: (_run, _error, run) => run.chatId && refreshChat(queryClient, run.chatId),
  });
}

export function useCreateCardTicket(): TrackerMutation<ChatDetail, CardTicketVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chatId, messageId, input }: CardTicketVariables) =>
      client.createCardTicket(chatId, messageId, input),
    onSuccess: (detail) => {
      showChat(queryClient, detail);
      void queryClient.invalidateQueries({ queryKey: queryKeys.board(detail.chat.projectKey) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
    },
  });
}

// The normal ticket prompt (§1.11), as the prompt sheet would start it without edits.
export function useRunCardTicket(): TrackerMutation<Run, RunCardTicketVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketKey, runnerId }: RunCardTicketVariables) => {
      const { text } = await client.getTicketPrompt(ticketKey);
      return client.startRun(ticketKey, { runnerId, prompt: text });
    },
    onSuccess: (run) => showRun(queryClient, run),
    onSettled: (_run, _error, { ticketKey }) => invalidateRuns(queryClient, ticketKey),
  });
}

// Deleted in another tab or on another device while this one missed the event: the person's
// wish is done.
function goneAlready(error: unknown): void {
  if (!isNotFound(error)) throw error;
}

export function useDeleteChat(): TrackerMutation<void, DeleteChatVariables> {
  const client = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: queryKeys.deletingChat(),
    mutationFn: ({ chatId }: DeleteChatVariables) => client.deleteChat(chatId).catch(goneAlready),
    // The chat's own query stays until it is unused: removing it under the open screen would
    // refetch it, and its 404 would navigate away a second time.
    onSuccess: (_result, { projectKey, chatId }) => {
      queryClient.setQueryData<Chat[]>(queryKeys.chats(projectKey), (chats) =>
        chats?.filter((chat) => chat.id !== chatId),
      );
    },
    onSettled: (_result, _error, { projectKey }) =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats(projectKey) }),
  });
}
