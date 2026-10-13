import { formatRelative, type ProjectSummary } from '@tracker/shared';
import clsx from 'clsx';
import { useIsOpening } from '../../navigation';
import styles from './ProjectCard.module.css';
import { ProjectProgressBar, ProjectProgressParts } from './ProjectProgressBar';
import { projectProgress } from './projectProgress';
import { descriptionText, riseDelay } from './projectRows';

interface ProjectCardProps {
  project: ProjectSummary;
  readyCount: number;
  index: number;
  now: number;
  onOpen: () => void;
}

export function ProjectCard({ project, readyCount, index, now, onOpen }: ProjectCardProps) {
  const opening = useIsOpening({ name: 'project', key: project.key });
  const progress = projectProgress(project, readyCount);
  return (
    <button
      type="button"
      className={clsx(styles.card, 'rise')}
      style={{ animationDelay: `${riseDelay(index)}ms` }}
      data-opening={opening || undefined}
      onClick={onOpen}
    >
      <span className={styles.head}>
        <span className={styles.square} style={{ background: project.color }} aria-hidden="true" />
        <span className={styles.name}>{project.name}</span>{' '}
        <span className={styles.key}>{project.key}</span>{' '}
        <span className={styles.updated}>
          <span className="visually-hidden">Updated</span>{' '}
          {formatRelative(project.lastActivityAt, now)}
        </span>
      </span>{' '}
      <span className={styles.description}>{descriptionText(project.description)}</span>{' '}
      <ProjectProgressBar progress={progress} /> <ProjectProgressParts progress={progress} />
    </button>
  );
}
