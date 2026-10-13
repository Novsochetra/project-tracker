import type { ProjectSummary } from '@tracker/shared';
import clsx from 'clsx';
import { LayoutGrid, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProjects, useReadyForYou } from '../api';
import { Icon, IconButton, LogoGlyph } from '../components';
import { AccountRow } from '../features/account';
import { sameProjectKey } from '../features/projects/projectLookup';
import { useOpenProject } from '../features/projects/useOpenProject';
import { openNotReady } from '../features/projects/projectProgress';
import { readyCounts, readyItems } from '../features/ready/readyItems';
import { ErrorBoundary } from '../lib/ErrorBoundary';
import { useIsOpening, useNavigation, type Route } from '../navigation';
import { projectKeyOf } from './crumbs';
import { useSheets } from './sheets/context';
import styles from './Sidebar.module.css';

interface SidebarItemProps {
  route: Route;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function SidebarItem({ route, active, onClick, children }: SidebarItemProps) {
  const opening = useIsOpening(route);
  return (
    <button
      type="button"
      className={clsx(styles.item, active && styles.active)}
      aria-current={active ? 'page' : undefined}
      data-opening={opening || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface ProjectItemsProps {
  projects: readonly ProjectSummary[];
  ready: ReadonlyMap<string, number>;
}

const NO_COUNTS: ReadonlyMap<string, number> = new Map();
const PROJECTS: Route = { name: 'projects' };

function ProjectItems({ projects, ready }: ProjectItemsProps) {
  const { route } = useNavigation();
  const openProject = useOpenProject();
  const activeKey = projectKeyOf(route);
  return projects.map((project) => (
    <SidebarItem
      key={project.id}
      route={{ name: 'project', key: project.key }}
      active={activeKey !== null && sameProjectKey(project.key, activeKey)}
      onClick={() => openProject(project.key)}
    >
      <span className={styles.square} style={{ background: project.color }} />
      <span className={styles.name}>{project.name}</span>{' '}
      {ready.has(project.id) && (
        <>
          <span className={styles.ready}>{ready.get(project.id)} ready</span>{' '}
        </>
      )}
      <span className={styles.count}>
        {openNotReady(project.openCount, ready.get(project.id) ?? 0)}{' '}
        <span className="visually-hidden">open</span>
      </span>
    </SidebarItem>
  ));
}

function ReadyProjectItems({ projects }: Pick<ProjectItemsProps, 'projects'>) {
  const ready = readyCounts(readyItems(useReadyForYou().data, projects));
  return <ProjectItems projects={projects} ready={ready} />;
}

export function Sidebar() {
  const { route, push } = useNavigation();
  const sheets = useSheets();
  const projects = useProjects().data ?? [];
  const readyList = useReadyForYou().data;
  return (
    <aside aria-label="Projects" className={styles.sidebar}>
      <div className={styles.brand}>
        <LogoGlyph />
        <span className={styles.brandName}>Tracker</span>
      </div>
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
          fallback={<ProjectItems projects={projects} ready={NO_COUNTS} />}
        >
          <ReadyProjectItems projects={projects} />
        </ErrorBoundary>
      </div>
      <AccountRow />
    </aside>
  );
}
