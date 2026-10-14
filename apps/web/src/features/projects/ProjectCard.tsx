import { formatRelative, projectDisplayName, type ProjectSummary } from '@tracker/shared';
import clsx from 'clsx';
import { useIsOpening } from '../../navigation';
import styles from './ProjectCard.module.css';
import { ProjectProgressBar, ProjectProgressParts } from './ProjectProgressBar';
import { projectProgress } from './projectProgress';
import { descriptionText, riseDelay } from './projectRows';

interface ProjectCardProps {
  project: ProjectSummary;
  readyCount: number;
  readyColor: string | undefined;
  index: number;
  now: number;
  onOpen: () => void;
}

export function ProjectCard(props: ProjectCardProps) {
  const { project, readyCount, readyColor, index, now, onOpen } = props;
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
        <span className={styles.name}>{projectDisplayName(project)}</span>{' '}
        {!project.hideName && <span className={styles.key}>{project.key}</span>}{' '}
        <span className={styles.updated}>
          <span className="visually-hidden">Updated</span>{' '}
          {formatRelative(project.lastActivityAt, now)}
        </span>
      </span>{' '}
      <span className={styles.description}>{descriptionText(project)}</span>{' '}
      <ProjectProgressBar progress={progress} readyColor={readyColor} />{' '}
      <ProjectProgressParts progress={progress} readyColor={readyColor} />
    </button>
  );
}
