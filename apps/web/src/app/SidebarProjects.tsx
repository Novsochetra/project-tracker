import { openNotReviewed, projectDisplayName, type ProjectSummary } from '@tracker/shared';
import { useId, useRef, type KeyboardEvent, type RefObject } from 'react';
import { consumeClickGuard } from '../features/project/dnd/clickGuard';
import { sameProjectKey } from '../features/projects/projectLookup';
import { REORDER_ROW_ATTRIBUTE } from '../features/projects/reorder/reorderRows';
import { useProjectOrder } from '../features/projects/reorder/useProjectOrder';
import { useRowReorder } from '../features/projects/reorder/useRowReorder';
import { useOpenProject } from '../features/projects/useOpenProject';
import { isApplePlatform } from '../features/search/paletteShortcut';
import { useNavigation } from '../navigation';
import { announce } from './announce';
import { projectKeyOf } from './crumbs';
import styles from './Sidebar.module.css';
import { SidebarItem } from './SidebarItem';

export interface SidebarProjectsProps {
  projects: readonly ProjectSummary[];
  ready: ReadonlyMap<string, number>;
  scroller: RefObject<HTMLElement | null>;
}

const reorderHint = (apple: boolean): string =>
  `Drag to change the order, or press ${apple ? 'Option' : 'Alt'} with the up or down arrow.`;

export function SidebarProjects({ projects, ready, scroller }: SidebarProjectsProps) {
  const { route } = useNavigation();
  const openProject = useOpenProject();
  const activeKey = projectKeyOf(route);
  const hintId = useId();
  const list = useRef<HTMLDivElement>(null);
  const order = useProjectOrder(projects);
  const reorder = useRowReorder({ ids: order.ids, list, scroller, commit: order.commit });
  const byId = new Map(projects.map((project) => [project.id, project]));
  const shown = order.ids.flatMap((id) => byId.get(id) ?? []);
  const moveByKey = (event: KeyboardEvent<HTMLElement>, project: ProjectSummary) => {
    const next = reorder.moveByKey(event, project.id);
    if (!next) return;
    const name = projectDisplayName(project);
    announce(`${name} moved to position ${next.indexOf(project.id) + 1} of ${next.length}`);
  };
  return (
    <div ref={list} className={styles.projects}>
      <span id={hintId} className="visually-hidden">
        {reorderHint(isApplePlatform())}
      </span>
      {shown.map((project) => (
        <SidebarItem
          key={project.id}
          route={{ name: 'project', key: project.key }}
          active={activeKey !== null && sameProjectKey(project.key, activeKey)}
          aria-describedby={hintId}
          aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
          {...{ [REORDER_ROW_ATTRIBUTE]: project.id }}
          onPointerDown={(event) => reorder.startDrag(event, project.id)}
          onKeyDown={(event) => moveByKey(event, project)}
          onClick={() => {
            if (!consumeClickGuard()) openProject(project.key);
          }}
        >
          <span className={styles.square} style={{ background: project.color }} />
          <span className={styles.name}>{projectDisplayName(project)}</span>{' '}
          {ready.has(project.id) && (
            <>
              <span className={styles.ready}>{ready.get(project.id)} ready</span>{' '}
            </>
          )}
          <span className={styles.count}>
            {openNotReviewed(project.openCount, ready.get(project.id) ?? 0)}{' '}
            <span className="visually-hidden">open</span>
          </span>
        </SidebarItem>
      ))}
    </div>
  );
}
