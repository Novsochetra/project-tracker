import type { ChatDetail, ChatMessage, Run } from '@tracker/shared';
import { stoppedWithSteps } from './chatFooter';

export type ThreadItem = { kind: 'message'; message: ChatMessage } | { kind: 'stopped'; run: Run };

// The latest question's end shows before the chat is read again (useCancelAsk keeps its run), so
// it joins the ones the tracker listed, in its newer copy.
export function stoppedRunsOf(detail: Pick<ChatDetail, 'run' | 'stoppedRuns'> | null): Run[] {
  const latest = stoppedWithSteps(detail?.run);
  const listed = (detail?.stoppedRuns ?? []).filter(({ id }) => id !== latest?.id);
  return latest ? [...listed, latest] : listed;
}

const timeOf = (item: ThreadItem): number =>
  item.kind === 'message' ? item.message.createdAt : item.run.createdAt;

// A question's run is made with it, at the same time, so a stopped run goes right after its
// question, before anything asked later.
export function threadItems(messages: ChatMessage[], stoppedRuns: Run[]): ThreadItem[] {
  const items: ThreadItem[] = messages.map((message) => ({ kind: 'message', message }));
  for (const run of [...stoppedRuns].sort((first, second) => first.createdAt - second.createdAt)) {
    const before = items.findLastIndex((item) => timeOf(item) <= run.createdAt);
    items.splice(before + 1, 0, { kind: 'stopped', run });
  }
  return items;
}
