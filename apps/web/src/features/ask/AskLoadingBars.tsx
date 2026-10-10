import { useProject } from '../../api';
import { ASK_LABEL, NEW_CHAT_LABEL } from '../../app/crumbs';
import { NavBar, NavBarSpacer } from '../../navigation';

// Shared by the screens while their data is on its way and the app's loading state while their
// code is (PT-108), so the bars stay put when either arrives.
export function ChatsLoadingBar({ projectKey }: { projectKey: string }) {
  const projectName = useProject(projectKey).data?.project.name ?? projectKey.toUpperCase();
  return <NavBar title={ASK_LABEL} backLabel={projectName} right={<NavBarSpacer />} />;
}

// A saved chat's title comes with the chat, so its bar waits for it.
export function ChatLoadingBar({ chatId }: { chatId: string | null }) {
  const title = chatId === null ? NEW_CHAT_LABEL : undefined;
  return <NavBar title={title} backLabel={ASK_LABEL} right={<NavBarSpacer />} />;
}
