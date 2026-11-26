import type { ProjectSummary } from '@tracker/shared';
import { LayoutGrid, Plus } from 'lucide-react';
import { useRef, type RefObject } from 'react';
import { useProjects, useReadyForYou } from '../api';
import { Icon, IconButton, LogoGlyph } from '../components';
import { AccountRow } from '../features/account';
import { readyCounts, readyItems } from '../features/ready/readyItems';
import { SearchButton } from '../features/search';
import { ErrorBoundary } from '../lib/ErrorBoundary';
import { useNavigation, type Route } from '../navigation';
import { useSheets } from './sheets/context';
import styles from './Sidebar.module.css';
import { SidebarItem } from './SidebarItem';
import { SidebarProjects } from './SidebarProjects';

const NO_COUNTS: ReadonlyMap<string, number> = new Map();
const PROJECTS: Route = { name: 'projects' };

interface ReadyProjectsProps {
  projects: readonly ProjectSummary[];
  scroller: RefObject<HTMLElement | null>;
}

function ReadyProjects({ projects, scroller }: ReadyProjectsProps) {
  const ready = readyCounts(readyItems(useReadyForYou().data, projects));

  return <SidebarProjects projects={projects} ready={ready} scroller={scroller} />;
}

export function Sidebar() {
  const { route, push } = useNavigation();
  const sheets = useSheets();
  const projects = useProjects().data ?? [];
  const readyList = useReadyForYou().data;
  const scroller = useRef<HTMLElement>(null);

  return (
    <aside ref={scroller} aria-label="Projects" className={styles.sidebar}>
      <div className={styles.brand}>
        <LogoGlyph />
        <span className={styles.brandName}>Tracker</span>
      </div>
      <SearchButton />
      <nav aria-label="Main" className={styles.group}>
        <SidebarItem
          route={PROJECTS}
          active={route.name === 'projects'}
          onClick={() => push(PROJECTS)}
        >
          <Icon icon={LayoutGrid} className={styles.navIcon} />
          <span className={styles.allProjects}>All projects</span>
        </SidebarItem>
      </nav>
      <div className={styles.group}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionLabel}>Projects</span>
          <IconButton
            size="xs"
            aria-label="New project"
            icon={Plus}
            onClick={() => sheets.open({ type: 'newProject' })}
          />
        </div>
        {/* A ready list it can't read only leaves out the counts; they are tried again once the
            list changes. Projects that fail fail the fallback too, and the sidebar's boundary
            takes over. */}
        <ErrorBoundary
          name="Sidebar ready counts"
          retryKey={readyList}
          fallback={<SidebarProjects projects={projects} ready={NO_COUNTS} scroller={scroller} />}
        >
          <ReadyProjects projects={projects} scroller={scroller} />
        </ErrorBoundary>
      </div>
      <AccountRow />
    </aside>
  );
}
