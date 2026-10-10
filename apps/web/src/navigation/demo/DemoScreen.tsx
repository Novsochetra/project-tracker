import type { Route } from '../routes';
import { DemoProjectScreen } from './DemoProjectScreen';
import { DemoProjectsScreen } from './DemoProjectsScreen';
import { DemoTicketScreen } from './DemoTicketScreen';

export function DemoScreen({ route }: { route: Route }) {
  switch (route.name) {
    case 'projects':
      return <DemoProjectsScreen />;
    case 'project':
      return <DemoProjectScreen projectKey={route.key} />;
    case 'ticket':
      return <DemoTicketScreen projectKey={route.key} num={route.num} />;
    case 'chats':
    case 'chat':
      return <DemoProjectScreen projectKey={route.key} />;
  }
}
