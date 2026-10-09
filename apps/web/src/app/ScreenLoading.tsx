import clsx from 'clsx';
import { useProject } from '../api';
import { Spinner } from '../components';
import { NavBar, NavBarSpacer, useNavigation, useOptionalScreen, type Route } from '../navigation';
import styles from './ScreenLoading.module.css';

export interface ScreenLoadingProps {
  // Bar and all, so a first load whose code comes in a moment shows nothing before its screen,
  // whose own bar would then show up a second time. A layer that slides in has its bar at once.
  quiet?: boolean;
}

function TicketBar({ projectKey, num }: { projectKey: string; num: number }) {
  const projectName = useProject(projectKey).data?.project.name ?? projectKey;
  const ticketKey = `${projectKey}-${num}`.toUpperCase();
  return <NavBar title={ticketKey} mono backLabel={projectName} right={<NavBarSpacer />} />;
}

// The bar of the screen's own placeholder (ProjectScreen, TicketScreen), so Back is there while
// the code is on its way (PT-108) and the bar stays put when it arrives.
function LoadingBar({ route }: { route: Route }) {
  switch (route.name) {
    case 'projects':
      return null;
    case 'project':
      return <NavBar backLabel="Projects" />;
    case 'ticket':
      return <TicketBar projectKey={route.key} num={route.num} />;
  }
}

export function ScreenLoading({ quiet = false }: ScreenLoadingProps) {
  const { route: current } = useNavigation();
  // A layer's own route, which it keeps while it slides away after a Back.
  const route = useOptionalScreen()?.route ?? current;
  return (
    <div className={clsx(quiet && 'quiet-in')}>
      <LoadingBar route={route} />
      <div className={clsx(styles.loading, !quiet && 'quiet-in')}>
        <Spinner />
      </div>
    </div>
  );
}
