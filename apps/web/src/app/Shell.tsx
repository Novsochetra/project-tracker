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

// One element each, so the stack's layers don't render again each time the Shell does.
const SCREEN_LOADING = <ScreenLoading />;
const FIRST_LOAD = <ScreenLoading quiet />;

export function Shell() {
  const reachability = useReachability();
  useLiveUpdates(reachability);
  useToastRaise(useBottomBarVisible());
  const isPhone = useIsPhone();
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
          {/* Above the stack, for a first load straight into a screen whose code is still on
              its way: the first screens have no boundary of their own. A screen opened later
              shows the stack's loading state in its own layer. */}
          <Suspense fallback={FIRST_LOAD}>
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
