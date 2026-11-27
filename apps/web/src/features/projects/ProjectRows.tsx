import { projectDisplayName, type ProjectSummary } from '@tracker/shared';
import { useId, useRef, type KeyboardEvent } from 'react';
import { announce } from '../../app/announce';
import { ListCard } from '../../components';
import { useScreen } from '../../navigation';
import { AUTO_SCROLL_BOTTOM_PHONE, AUTO_SCROLL_TOP } from '../project/dnd/autoScroll';
import { consumeClickGuard } from '../project/dnd/clickGuard';
import { isApplePlatform } from '../search/paletteShortcut';
import { ProjectRow } from './ProjectRow';
import { movedMessage, reorderHint } from './reorder/reorderHint';
import { REORDER_ROW_ATTRIBUTE } from './reorder/reorderRows';
import { useProjectOrder } from './reorder/useProjectOrder';
import { useRowReorder } from './reorder/useRowReorder';
import { useOpenProject } from './useOpenProject';

export interface ProjectRowsProps {
  projects: readonly ProjectSummary[];
  readyCounts: ReadonlyMap<string, number>;
}

// Under the nav bar and above the capture bar, as the ticket list's drag (SPEC §7.4).
const PHONE_EDGES = { start: AUTO_SCROLL_TOP, end: AUTO_SCROLL_BOTTOM_PHONE };

// The phone's Projects list: a finger that rests on a row lifts it to drag it to a new place.
export function ProjectRows({ projects, readyCounts }: ProjectRowsProps) {
  const openProject = useOpenProject();
  const { scrollRef } = useScreen();
  const hintId = useId();
  const list = useRef<HTMLDivElement>(null);
  const order = useProjectOrder(projects);
  const reorder = useRowReorder({
    ids: order.ids,
    list,
    scroller: scrollRef,
    commit: order.commit,
    holdToLift: true,
    edges: PHONE_EDGES,
  });
  const byId = new Map(projects.map((project) => [project.id, project]));
  const shown = order.ids.flatMap((id) => byId.get(id) ?? []);
  const moveByKey = (event: KeyboardEvent<HTMLElement>, project: ProjectSummary) => {
    const next = reorder.moveByKey(event, project.id);
    if (next) announce(movedMessage(projectDisplayName(project), next, project.id));
  };

  return (
    <div ref={list}>
      <span id={hintId} className="visually-hidden">
        {reorderHint(isApplePlatform(), true)}
      </span>
      <ListCard>
        {shown.map((project, index) => (
          <ProjectRow
            key={project.id}
            project={project}
            readyCount={readyCounts.get(project.id) ?? 0}
            index={index}
            aria-describedby={hintId}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
            {...{ [REORDER_ROW_ATTRIBUTE]: project.id }}
            onPointerDown={(event) => reorder.startDrag(event, project.id)}
            onKeyDown={(event) => moveByKey(event, project)}
            onOpen={() => {
              if (!consumeClickGuard()) openProject(project.key);
            }}
          />
        ))}
      </ListCard>
    </div>
  );
}
