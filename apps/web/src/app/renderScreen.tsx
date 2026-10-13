import type { ReactNode } from 'react';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { ErrorBoundary } from '../lib/ErrorBoundary';
import { routePath, type Route } from '../navigation';
import { ChatScreen, ChatsScreen, ProjectScreen, TicketScreen } from './lazyParts';
import { ScreenError } from './ScreenError';

function screenFor(route: Route): ReactNode {
  switch (route.name) {
    case 'projects':
      return <ProjectsScreen />;
    case 'project':
      return <ProjectScreen projectKey={route.key} />;
    case 'ticket':
      return <TicketScreen projectKey={route.key} num={route.num} />;
    case 'chats':
      return <ChatsScreen projectKey={route.key} />;
    case 'chat':
      return (
        <ChatScreen projectKey={route.key} chatId={route.chatId} ticketNum={route.ticketNum} />
      );
  }
}

// The boundary sits inside the screen's stack layer, so the stack and its edge swipe outlive a
// screen that fails.
export function renderScreen(route: Route): ReactNode {
  return (
    <ErrorBoundary name={`Screen ${routePath(route)}`} fallback={<ScreenError />}>
      {screenFor(route)}
    </ErrorBoundary>
  );
}
