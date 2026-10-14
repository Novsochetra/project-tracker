import { Plus, SquarePen } from 'lucide-react';
import { useChat } from '../api/hooks/chats';
import { Button } from '../components';
import { ChatOptionsMenu } from '../features/ask/ChatOptionsMenu';
import { ProjectOptionsButton } from '../features/projects/ProjectOptionsButton';
import { ProjectsHeaderActions } from '../features/projects/ProjectsHeaderActions';
import { useProjectSummary } from '../features/projects/useProjectSummary';
import { useNavigation, type Route } from '../navigation';
import { Breadcrumb } from './Breadcrumb';
import { breadcrumbFor, NEW_CHAT_LABEL, projectKeyOf } from './crumbs';
import styles from './DesktopHeader.module.css';
import { useSheets } from './sheets/context';

// The chat screen's own options: a header with other options took over the shared query (PT-250).
function useChatTitle(route: Route): string | undefined {
  const chat = useChat(route.name === 'chat' ? route.chatId : null);
  return chat.data?.chat.title;
}

function HeaderActions({ route, projectKey }: { route: Route; projectKey: string }) {
  const sheets = useSheets();
  const { push } = useNavigation();
  switch (route.name) {
    case 'projects':
      return <ProjectsHeaderActions />;
    case 'project':
      return (
        <div className={styles.actions}>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => sheets.open({ type: 'newTicket', projectKey })}
          >
            New ticket
          </Button>
          <ProjectOptionsButton projectKey={projectKey} placement="header" />
        </div>
      );
    case 'chats':
      return (
        <Button
          variant="primary"
          icon={SquarePen}
          onClick={() => push({ name: 'chat', key: projectKey, chatId: null })}
        >
          {NEW_CHAT_LABEL}
        </Button>
      );
    case 'chat':
      return route.chatId && <ChatOptionsMenu projectKey={projectKey} chatId={route.chatId} />;
    case 'ticket':
    case 'activity':
      return null;
  }
}

export function DesktopHeader() {
  const { route } = useNavigation();
  const routeKey = projectKeyOf(route) ?? '';
  const project = useProjectSummary(routeKey);
  const chatTitle = useChatTitle(route);
  return (
    <header className={styles.header}>
      <Breadcrumb crumbs={breadcrumbFor(route, project, chatTitle)} />
      <HeaderActions route={route} projectKey={project?.key ?? routeKey} />
    </header>
  );
}
