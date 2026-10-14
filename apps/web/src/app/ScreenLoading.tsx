import clsx from 'clsx';
import { Spinner } from '../components';
import { ChatLoadingBar, ChatsLoadingBar } from '../features/ask/AskLoadingBars';
import { ProjectLoadingBar } from '../features/project/ProjectLoadingBar';
import { TicketLoadingBar } from '../features/ticket/TicketLoadingBar';
import { styleNow } from '../lib/styleNow';
import { useNavigation, useOptionalScreen, type Route } from '../navigation';
import styles from './ScreenLoading.module.css';

export interface ScreenLoadingProps {
  // Bar and all, so a first load whose code comes in a moment shows nothing before its screen,
  // whose own bar would then show up a second time. A layer that slides in has its bar at once.
  quiet?: boolean;
}

// The bar of the screen's own placeholder, so Back is there while the code is on its way (PT-108).
function LoadingBar({ route }: { route: Route }) {
  switch (route.name) {
    case 'projects':
    case 'activity':
      return null;
    case 'project':
      return <ProjectLoadingBar />;
    case 'ticket':
      return <TicketLoadingBar projectKey={route.key} num={route.num} />;
    case 'chats':
      return <ChatsLoadingBar projectKey={route.key} />;
    case 'chat':
      return <ChatLoadingBar chatId={route.chatId} />;
  }
}

export function ScreenLoading({ quiet = false }: ScreenLoadingProps) {
  const { route: current } = useNavigation();
  // A layer's own route, which it keeps while it slides away after a Back.
  const route = useOptionalScreen()?.route ?? current;
  // A deep link starts its screens' stylesheets as the app starts, and a stalled push its screen's.
  return (
    <div ref={styleNow} className={clsx(quiet && 'quiet-in')}>
      <LoadingBar route={route} />
      <div className={clsx(styles.loading, !quiet && 'quiet-in')}>
        <Spinner />
      </div>
    </div>
  );
}
