import { filterCounts, type ProjectBoard } from '@tracker/shared';
import { CircleAlert } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';
import { errorMessage, isNotFound, useBoard } from '../../api';
import { Button, EmptyState } from '../../components';
import { PullToRefresh } from '../../gestures';
import { NavBar, useNavigation, useScreen } from '../../navigation';
import { FilterRow } from './FilterRow';
import { resetListView } from './listViewStore';
import { ProjectBottomBar, ProjectNavBar, ProjectToolbar } from './ProjectBars';
import styles from './ProjectScreen.module.css';
import { TicketList } from './TicketList';

interface ProjectViewProps {
  board: ProjectBoard;
  onRefresh: () => Promise<unknown>;
}

function ProjectView({ board, onRefresh }: ProjectViewProps) {
  const { scrollRef } = useScreen();
  const { project } = board;
  return (
    <>
      <ProjectNavBar project={project} />
      <PullToRefresh onRefresh={onRefresh} scrollRef={scrollRef}>
        <div className={styles.page}>
          <ProjectToolbar project={project} />
          <FilterRow
            projectKey={project.key}
            counts={filterCounts(board.tickets, board.statuses)}
          />
          <TicketList board={board} />
        </div>
      </PullToRefresh>
      <ProjectBottomBar projectKey={project.key} />
    </>
  );
}

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <EmptyState
      icon={CircleAlert}
      title="Couldn't load this project"
      text={errorMessage(error)}
      action={<Button onClick={onRetry}>Try again</Button>}
    />
  );
}

/** Opening a project shows All with an empty search (SPEC §3); coming back from a ticket keeps them. */
function useFreshListView(projectKey: string): void {
  useLayoutEffect(() => resetListView(projectKey), [projectKey]);
}

function useLeaveMissingProject(error: Error | null): void {
  const { isTop } = useScreen();
  const { replace } = useNavigation();
  const missing = error !== null && isNotFound(error);
  useEffect(() => {
    if (missing && isTop) replace('/');
  }, [missing, isTop, replace]);
}

export function ProjectScreen({ projectKey }: { projectKey: string }) {
  const { data, error, refetch } = useBoard(projectKey);
  useFreshListView(projectKey);
  useLeaveMissingProject(error);
  if (data) return <ProjectView board={data} onRefresh={() => refetch()} />;
  return (
    <>
      <NavBar backLabel="Projects" />
      {error && !isNotFound(error) && <LoadError error={error} onRetry={() => void refetch()} />}
    </>
  );
}
