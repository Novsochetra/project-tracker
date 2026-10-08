import clsx from 'clsx';
import { LayoutGrid, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useProjects, useReadyForYou } from '../api';
import { Icon, IconButton, LogoGlyph } from '../components';
import { sameProjectKey } from '../features/projects/projectLookup';
import { readyCounts, readyItems } from '../features/ready/readyItems';
import { useNavigation } from '../navigation';
import { projectKeyOf } from './crumbs';
import { useSheets } from './sheets/context';
import styles from './Sidebar.module.css';

function SidebarItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={clsx(styles.item, active && styles.active)}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Sidebar() {
  const { route, push } = useNavigation();
  const sheets = useSheets();
  const projects = useProjects().data ?? [];
  const ready = readyCounts(readyItems(useReadyForYou().data, projects));
  const activeKey = projectKeyOf(route);
  return (
    <aside aria-label="Projects" className={styles.sidebar}>
      <div className={styles.brand}>
        <LogoGlyph />
        <span className={styles.brandName}>Tracker</span>
      </div>
      <nav aria-label="Main" className={styles.group}>
        <SidebarItem active={route.name === 'projects'} onClick={() => push({ name: 'projects' })}>
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
        {projects.map((project) => (
          <SidebarItem
            key={project.id}
            active={activeKey !== null && sameProjectKey(project.key, activeKey)}
            onClick={() => push({ name: 'project', key: project.key })}
          >
            <span className={styles.square} style={{ background: project.color }} />
            <span className={styles.name}>{project.name}</span>{' '}
            {ready.has(project.id) && (
              <>
                <span className={styles.ready}>{ready.get(project.id)} ready</span>{' '}
              </>
            )}
            <span className={styles.count}>
              {project.openCount} <span className="visually-hidden">open</span>
            </span>
          </SidebarItem>
        ))}
      </div>
    </aside>
  );
}
