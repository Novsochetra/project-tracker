import type { ReactNode } from 'react';
import { ProjectScreen } from '../features/project/ProjectScreen';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { TicketScreen } from '../features/ticket/TicketScreen';
import { ErrorBoundary } from '../lib/ErrorBoundary';
import { routePath, type Route } from '../navigation';
import { ScreenError } from './ScreenError';

function screenFor(route: Route): ReactNode {
  switch (route.name) {
    case 'projects':
      return <ProjectsScreen />;
    case 'project':
      return <ProjectScreen projectKey={route.key} />;
    case 'ticket':
      return <TicketScreen projectKey={route.key} num={route.num} />;
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
