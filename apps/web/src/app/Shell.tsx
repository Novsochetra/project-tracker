import clsx from 'clsx';
import { Suspense } from 'react';
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
import { ScreenLoading } from './ScreenLoading';
import { HeaderError, ShellBoundary, SidebarError } from './ShellError';
import styles from './Shell.module.css';
import { Sidebar } from './Sidebar';
import { useApiUnreachable, useReachability } from './useApiUnreachable';

// One element, so the stack's layers don't render again each time the Shell does.
const SCREEN_LOADING = <ScreenLoading />;

export function Shell() {
  useLiveUpdates();
  useToastRaise(useBottomBarVisible());
  const isPhone = useIsPhone();
  const reachability = useReachability();
  const unreachable = useApiUnreachable(reachability);
  return (
    <div className={styles.shell}>
      {!isPhone && (
        <ShellBoundary name="Sidebar" fallback={<SidebarError />}>
          <Sidebar />
        </ShellBoundary>
      )}
      <div className={styles.column}>
        {!isPhone && (
          <ShellBoundary name="Desktop header" fallback={<HeaderError />}>
            <DesktopHeader />
          </ShellBoundary>
        )}
        {unreachable && <OfflineBanner />}
        <main className={clsx(styles.stack, unreachable && styles.belowBanner)}>
          {/* Above the stack, so the browser's Back or Forward to a screen whose code is still
              on its way keeps the current screen until it arrives (navigations are transitions)
              instead of sliding in a blank one. Only a first load straight into such a screen
              shows this fallback; a push that waited out its time limit shows the stack's. */}
          <Suspense fallback={SCREEN_LOADING}>
            <StackNavigator renderScreen={renderScreen} loading={SCREEN_LOADING} />
          </Suspense>
        </main>
      </div>
      <RouteFallback />
      <LiveRegion />
      <QuickCapture reachability={reachability} />
    </div>
  );
}
