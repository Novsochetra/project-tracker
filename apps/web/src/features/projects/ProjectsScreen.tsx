import type { ProjectSummary } from '@tracker/shared';
import { Folder, Plus } from 'lucide-react';
import { errorMessage, useProjects, useReadyForYou, type TrackerQuery } from '../../api';
import { useSheets } from '../../app/sheets/context';
import { Button, EmptyState, Icon } from '../../components';
import { PullToRefresh } from '../../gestures';
import { useIsPhone } from '../../lib/media';
import { LargeTitle, NavBar, NavBarButton, useScreen } from '../../navigation';
import { CaptureBar, CaptureButton, canCapture, WaitingToSync } from '../capture';
import { readyCounts, readyItems, ReadySection } from '../ready';
import { ProjectList } from './ProjectList';
import styles from './ProjectsScreen.module.css';

export function ProjectsScreen() {
  const projects = useProjects();
  const ready = useReadyForYou();
  const items = readyItems(ready.data, projects.data ?? []);
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
            <ReadySection items={items} />
            <ProjectsBody query={projects} readyCounts={readyCounts(items)} onNew={openNew} />
          </div>
        </div>
      </PullToRefresh>
      {capture && <CaptureBar onClick={openCapture} />}
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
