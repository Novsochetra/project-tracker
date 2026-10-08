import type { ReactNode } from 'react';
import { ProjectScreen } from '../features/project/ProjectScreen';
import { ProjectsScreen } from '../features/projects/ProjectsScreen';
import { TicketScreen } from '../features/ticket/TicketScreen';
import type { Route } from '../navigation';

export function renderScreen(route: Route): ReactNode {
  switch (route.name) {
    case 'projects':
      return <ProjectsScreen />;
    case 'project':
      return <ProjectScreen projectKey={route.key} />;
    case 'ticket':
      return <TicketScreen projectKey={route.key} num={route.num} />;
  }
}
