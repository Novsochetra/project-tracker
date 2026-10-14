import type { ProjectSummary, TicketsAcrossProjects } from '@tracker/shared';
import { Folder, Plus } from 'lucide-react';
import { errorMessage, useProjects, useReadyForYou, type TrackerQuery } from '../../api';
import { useSheets } from '../../app/sheets/context';
import { Button, EmptyState, Icon } from '../../components';
import { PullToRefresh } from '../../gestures';
import { ErrorBoundary } from '../../lib/ErrorBoundary';
import { LargeTitle, NavBar, NavBarButton, useScreen } from '../../navigation';
import { AccountButton } from '../account';
import { HomeTabs } from '../activity/HomeTabs';
import { CaptureBar, canCapture, WaitingToSync } from '../capture';
import { readyItems, ReadySection, type ReadyItem } from '../ready';
import { ProjectList } from './ProjectList';
import styles from './ProjectsScreen.module.css';

export function ProjectsScreen() {
  const projects = useProjects();
  const ready = useReadyForYou();
  const sheets = useSheets();
  const { scrollRef } = useScreen();
  const openNew = () => sheets.open({ type: 'newProject' });
  const openCapture = () => sheets.open({ type: 'capture' });
  const capture = canCapture(projects.data);
  return (
    <>
      <NavBar
        title="Projects"
        left={<AccountButton />}
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
            <LargeTitle aside={projects.data?.length}>Projects</LargeTitle>
            <HomeTabs />
            <WaitingToSync />
            {/* A ready list it can't read only leaves out the Ready card and the counts; they are
                tried again once the list changes. Projects that fail fail the fallback too, and
                the screen's boundary takes over. */}
            <ErrorBoundary
              name="Projects ready list"
              retryKey={ready.data}
              fallback={<ProjectsBody query={projects} ready={NOTHING_READY} onNew={openNew} />}
            >
              <ProjectsAndReady query={projects} ready={ready.data} onNew={openNew} />
            </ErrorBoundary>
          </div>
        </div>
      </PullToRefresh>
      {capture && <CaptureBar onClick={openCapture} />}
    </>
  );
}

const NOTHING_READY: readonly ReadyItem[] = [];

interface ProjectsAndReadyProps {
  query: TrackerQuery<ProjectSummary[]>;
  ready: TicketsAcrossProjects | undefined;
  onNew: () => void;
}

function ProjectsAndReady({ query, ready, onNew }: ProjectsAndReadyProps) {
  const items = readyItems(ready, query.data ?? []);
  return (
    <>
      <ProjectsBody query={query} ready={items} onNew={onNew} />
      <ReadySection items={items} />
    </>
  );
}

interface ProjectsBodyProps {
  query: TrackerQuery<ProjectSummary[]>;
  ready: readonly ReadyItem[];
  onNew: () => void;
}

function ProjectsBody({ query, ready, onNew }: ProjectsBodyProps) {
  if (query.data) {
    return query.data.length > 0 ? (
      <ProjectList projects={query.data} ready={ready} />
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
