import clsx from 'clsx';
import { useLiveUpdates } from '../api';
import { useToastRaise } from '../components';
import { QuickCapture } from '../features/capture';
import { useIsPhone } from '../lib/media';
import { StackNavigator, useBottomBarVisible } from '../navigation';
import { DesktopHeader } from './DesktopHeader';
import { LiveRegion } from './LiveRegion';
import { OfflineBanner } from './OfflineBanner';
import { renderScreen } from './renderScreen';
import { RouteFallback } from './RouteFallback';
import styles from './Shell.module.css';
import { Sidebar } from './Sidebar';
import { useApiUnreachable, useReachability } from './useApiUnreachable';

export function Shell() {
  useLiveUpdates();
  useToastRaise(useBottomBarVisible());
  const isPhone = useIsPhone();
  const reachability = useReachability();
  const unreachable = useApiUnreachable(reachability);
  return (
    <div className={styles.shell}>
      {!isPhone && <Sidebar />}
      <div className={styles.column}>
        {!isPhone && <DesktopHeader />}
        {unreachable && <OfflineBanner />}
        <main className={clsx(styles.stack, unreachable && styles.belowBanner)}>
          <StackNavigator renderScreen={renderScreen} />
        </main>
      </div>
      <RouteFallback />
      <LiveRegion />
      <QuickCapture reachability={reachability} />
    </div>
  );
}
