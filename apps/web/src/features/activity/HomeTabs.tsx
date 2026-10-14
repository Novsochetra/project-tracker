import clsx from 'clsx';
import { useIsPhone } from '../../lib/media';
import { useNavigation, type Route } from '../../navigation';
import styles from './HomeTabs.module.css';

const TABS: ReadonlyArray<{ route: Route; label: string }> = [
  { route: { name: 'projects' }, label: 'Projects' },
  { route: { name: 'activity' }, label: 'Activity' },
];

// The sidebar has these two on larger screens, so only phones get the tabs.
export function HomeTabs() {
  const isPhone = useIsPhone();
  const { route, replace } = useNavigation();
  if (!isPhone) return null;
  return (
    <nav aria-label="Home" className={styles.tabs}>
      {TABS.map((tab) => {
        const active = tab.route.name === route.name;
        return (
          <button
            key={tab.label}
            type="button"
            className={clsx('ring-inside', styles.tab, active && styles.active)}
            aria-current={active ? 'page' : undefined}
            onClick={() => !active && replace(tab.route)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
