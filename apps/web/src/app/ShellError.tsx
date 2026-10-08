import clsx from 'clsx';
import { CircleAlert, LayoutGrid } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProjects } from '../api';
import { Icon, LogoGlyph } from '../components';
import { ErrorBoundary } from '../lib/ErrorBoundary';
import { useNavigation } from '../navigation';
import headerStyles from './DesktopHeader.module.css';
import styles from './ShellError.module.css';
import sidebarStyles from './Sidebar.module.css';

export interface ShellBoundaryProps {
  name: string;
  fallback: ReactNode;
  children: ReactNode;
}

// The sidebar and header sit outside every screen, so one that fails would blank the app. Both
// read the projects answer, so they are tried again once it changes.
export function ShellBoundary({ name, fallback, children }: ShellBoundaryProps) {
  const projects = useProjects().data;
  return (
    <ErrorBoundary name={name} retryKey={projects} fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}

// Only the frame and the way home, nothing read from the answer it failed on.
export function SidebarError() {
  const { route, push } = useNavigation();
  const home = route.name === 'projects';
  return (
    <aside aria-label="Projects" className={sidebarStyles.sidebar}>
      <div className={sidebarStyles.brand}>
        <LogoGlyph />
        <span className={sidebarStyles.brandName}>Tracker</span>
      </div>
      <nav aria-label="Main" className={sidebarStyles.group}>
        <button
          type="button"
          className={clsx(sidebarStyles.item, home && sidebarStyles.active)}
          aria-current={home ? 'page' : undefined}
          onClick={() => push({ name: 'projects' })}
        >
          <Icon icon={LayoutGrid} className={sidebarStyles.navIcon} />
          <span className={sidebarStyles.allProjects}>All projects</span>
        </button>
      </nav>
      <p className={styles.notice}>
        <Icon icon={CircleAlert} size={14} />
        Couldn't show the projects
      </p>
    </aside>
  );
}

// An empty bar of the same height, so the screens below don't move.
export function HeaderError() {
  return <header className={headerStyles.header} />;
}
