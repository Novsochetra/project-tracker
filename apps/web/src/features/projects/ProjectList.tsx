import type { ProjectSummary } from '@tracker/shared';
import { ListCard } from '../../components';
import { useIsPhone } from '../../lib/media';
import { useNow } from '../../lib/useNow';
import { ProjectCard } from './ProjectCard';
import styles from './ProjectCard.module.css';
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
  const readyOf = (project: ProjectSummary) => readyCounts.get(project.id) ?? 0;
  if (isPhone) {
    return (
      <ListCard>
        {projects.map((project, index) => (
          <ProjectRow
            key={project.id}
            project={project}
            readyCount={readyOf(project)}
            index={index}
            onOpen={() => openProject(project.key)}
          />
        ))}
      </ListCard>
    );
  }
  return (
    <ul className={styles.grid}>
      {projects.map((project, index) => (
        <li key={project.id} className={styles.cell}>
          <ProjectCard
            project={project}
            readyCount={readyOf(project)}
            index={index}
            now={now}
            onOpen={() => openProject(project.key)}
          />
        </li>
      ))}
    </ul>
  );
}
