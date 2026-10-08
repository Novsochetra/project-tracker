import type { ProjectSummary, TicketsAcrossProjects } from '@tracker/shared';
import { Folder, Plus } from 'lucide-react';
import { errorMessage, useProjects, useReadyForYou, type TrackerQuery } from '../../api';
import { useSheets } from '../../app/sheets/context';
import { Button, EmptyState, Icon } from '../../components';
import { PullToRefresh } from '../../gestures';
import { ErrorBoundary } from '../../lib/ErrorBoundary';
import { useIsPhone } from '../../lib/media';
import { LargeTitle, NavBar, NavBarButton, useScreen } from '../../navigation';
import { CaptureBar, CaptureButton, canCapture, WaitingToSync } from '../capture';
import { readyCounts, readyItems, ReadySection } from '../ready';
import { ProjectList } from './ProjectList';
import styles from './ProjectsScreen.module.css';

export function ProjectsScreen() {
  const projects = useProjects();
  const ready = useReadyForYou();
  const sheets = useSheets();
  const isPhone = useIsPhone();
  const { scrollRef } = useScreen();
  const openNew = () => sheets.open({ type: 'newProject' });
  const openCapture = () => sheets.open({ type: 'capture' });
  const capture = canCapture(projects.data);
  return (
    <>
      <NavBar
        title="Projects"
        right={
          <NavBarButton aria-label="New project" onClick={openNew}>
            <Icon icon={Plus} size={20} />
          </NavBarButton>
        }
      />
      <PullToRefresh
        onRefresh={() => Promise.all([projects.refetch(), ready.refetch()])}
        scrollRef={scrollRef}
      >
        <div className={styles.page}>
          <div className={styles.content}>
            <div className={styles.titleRow}>
              <LargeTitle aside={projects.data?.length}>Projects</LargeTitle>
              {capture && !isPhone && <CaptureButton onClick={openCapture} />}
            </div>
            <WaitingToSync />
            {/* A ready list it can't read only leaves out the Ready card and the counts; they are
                tried again once the list changes. Projects that fail fail the fallback too, and
                the screen's boundary takes over. */}
            <ErrorBoundary
              name="Projects ready list"
              retryKey={ready.data}
              fallback={<ProjectsBody query={projects} readyCounts={NO_COUNTS} onNew={openNew} />}
            >
              <ReadyAndProjects query={projects} ready={ready.data} onNew={openNew} />
            </ErrorBoundary>
          </div>
        </div>
      </PullToRefresh>
      {capture && <CaptureBar onClick={openCapture} />}
    </>
  );
}

const NO_COUNTS: ReadonlyMap<string, number> = new Map();

interface ReadyAndProjectsProps {
  query: TrackerQuery<ProjectSummary[]>;
  ready: TicketsAcrossProjects | undefined;
  onNew: () => void;
}

function ReadyAndProjects({ query, ready, onNew }: ReadyAndProjectsProps) {
  const items = readyItems(ready, query.data ?? []);
  return (
    <>
      <ReadySection items={items} />
      <ProjectsBody query={query} readyCounts={readyCounts(items)} onNew={onNew} />
    </>
  );
}

interface ProjectsBodyProps {
  query: TrackerQuery<ProjectSummary[]>;
  readyCounts: ReadonlyMap<string, number>;
  onNew: () => void;
}

function ProjectsBody({ query, readyCounts, onNew }: ProjectsBodyProps) {
  if (query.data) {
    return query.data.length > 0 ? (
      <ProjectList projects={query.data} readyCounts={readyCounts} />
    ) : (
      <EmptyState
        bordered
        icon={Folder}
        title="No projects yet"
        text="Projects hold your tickets. Create one to get started."
        action={
          <Button variant="primary" className={styles.emptyAction} onClick={onNew}>
            New project
          </Button>
        }
      />
    );
  }
  if (!query.error) return null;
  return (
    <div className={styles.loadError}>
      <p role="alert">{errorMessage(query.error)}</p>
      <Button onClick={() => void query.refetch()}>Try again</Button>
    </div>
  );
}
