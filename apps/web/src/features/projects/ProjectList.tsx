import type { ProjectSummary } from '@tracker/shared';
import { ListCard } from '../../components';
import { useIsPhone } from '../../lib/media';
import { useNow } from '../../lib/useNow';
import styles from './ProjectList.module.css';
import { ProjectRow } from './ProjectRow';
import { useOpenProject } from './useOpenProject';

export interface ProjectListProps {
  projects: readonly ProjectSummary[];
  readyCounts: ReadonlyMap<string, number>;
}

export function ProjectList({ projects, readyCounts }: ProjectListProps) {
  const isPhone = useIsPhone();
  const now = useNow();
  const openProject = useOpenProject();
  return (
    <ListCard className={styles.list}>
      {!isPhone && (
        <div className={styles.head} aria-hidden="true">
          <span className={styles.nameHead}>Name</span>
          <span className={styles.progressHead}>Progress</span>
          <span className={styles.openHead}>Open</span>
          <span className={styles.updatedHead}>Updated</span>
        </div>
      )}
      {projects.map((project, index) => (
        <ProjectRow
          key={project.id}
          project={project}
          readyCount={readyCounts.get(project.id) ?? 0}
          index={index}
          now={now}
          onOpen={() => openProject(project.key)}
        />
      ))}
    </ListCard>
  );
}
