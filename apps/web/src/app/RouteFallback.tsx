import { useEffect } from 'react';
import { isNotFound, useBoard, useTicket } from '../api';
import { parentRoute, routePath, useNavigation, type Route } from '../navigation';

// Same query keys as the screens, so these checks never cost an extra request.
function useLeaveWhenMissing(missing: boolean, route: Route) {
  const { replace } = useNavigation();
  const parent = parentRoute(route);
  const target = parent && routePath(parent);
  useEffect(() => {
    if (missing && target) replace(target);
  }, [missing, target, replace]);
}

function ProjectCheck({ route }: { route: Extract<Route, { name: 'project' }> }) {
  const { error } = useBoard(route.key);
  useLeaveWhenMissing(isNotFound(error), route);
  return null;
}

function TicketCheck({ route }: { route: Extract<Route, { name: 'ticket' }> }) {
  const { error } = useTicket(`${route.key}-${route.num}`);
  useLeaveWhenMissing(isNotFound(error), route);
  return null;
}

export function RouteFallback() {
  const { route } = useNavigation();
  switch (route.name) {
    // The chat screens leave a missing chat or project themselves, step by step up the stack.
    case 'projects':
    case 'chats':
    case 'chat':
      return null;
    case 'project':
      return <ProjectCheck key={route.key} route={route} />;
    case 'ticket':
      return <TicketCheck key={`${route.key}-${route.num}`} route={route} />;
  }
}
