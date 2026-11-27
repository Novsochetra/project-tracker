import type { ProjectSummary } from '@tracker/shared';
import { useIsPhone } from '../../lib/media';
import { useNow } from '../../lib/useNow';
import { readyColors, readyCounts, type ReadyItem } from '../ready';
import { ProjectCard } from './ProjectCard';
import styles from './ProjectList.module.css';
import { ProjectRows } from './ProjectRows';
import { useOpenProject } from './useOpenProject';

export interface ProjectListProps {
  projects: readonly ProjectSummary[];
  ready: readonly ReadyItem[];
}

export function ProjectList({ projects, ready }: ProjectListProps) {
  const isPhone = useIsPhone();
  const now = useNow();
  const openProject = useOpenProject();
  const counts = readyCounts(ready);
  const colors = readyColors(ready);
  if (isPhone) return <ProjectRows projects={projects} readyCounts={counts} />;

  return (
    <ul className={styles.grid}>
      {projects.map((project, index) => (
        <li key={project.id} className={styles.cell}>
          <ProjectCard
            project={project}
            readyCount={counts.get(project.id) ?? 0}
            readyColor={colors.get(project.id)}
            index={index}
            now={now}
            onOpen={() => openProject(project.key)}
          />
        </li>
      ))}
    </ul>
  );
}
