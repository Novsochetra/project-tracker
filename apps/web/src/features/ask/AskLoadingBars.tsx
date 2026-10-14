import { projectDisplayName } from '@tracker/shared';
import { useProject } from '../../api';
import { ASK_LABEL, NEW_CHAT_LABEL } from '../../app/crumbs';
import { NavBar, NavBarSpacer } from '../../navigation';
import { chatBackLabel } from './ticketChat';

// Shared by the screens while their data is on its way and the app's loading state while their
// code is (PT-108), so the bars stay put when either arrives.
export function ChatsLoadingBar({ projectKey }: { projectKey: string }) {
  const project = useProject(projectKey).data?.project;
  const backLabel = project ? projectDisplayName(project) : projectKey.toUpperCase();
  return <NavBar title={ASK_LABEL} backLabel={backLabel} right={<NavBarSpacer />} />;
}

// A saved chat's title comes with the chat, so its bar waits for it.
export interface ChatLoadingBarProps {
  projectKey: string;
  chatId: string | null;
  ticketNum?: number | undefined;
}

export function ChatLoadingBar({ projectKey, chatId, ticketNum }: ChatLoadingBarProps) {
  const title = chatId === null ? NEW_CHAT_LABEL : undefined;
  const backLabel = chatBackLabel(projectKey, ticketNum);
  return <NavBar title={title} backLabel={backLabel} right={<NavBarSpacer />} />;
}
