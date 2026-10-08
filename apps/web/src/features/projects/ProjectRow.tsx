import { formatRelative, type ProjectSummary } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Icon, ListRow } from '../../components';
import styles from './ProjectList.module.css';
import { descriptionText, progressPercent, riseDelay } from './projectRows';

interface ProjectRowProps {
  project: ProjectSummary;
  readyCount: number;
  index: number;
  now: number;
  onOpen: () => void;
}

export function ProjectRow({ project, readyCount, index, now, onOpen }: ProjectRowProps) {
  const percent = progressPercent(project.doneCount, project.totalCount);
  return (
    <ListRow
      className={clsx(styles.row, 'rise')}
      style={{ animationDelay: `${riseDelay(index)}ms` }}
      onClick={onOpen}
    >
      <span className={styles.main}>
        <span className={styles.square} style={{ background: project.color }} aria-hidden="true" />
        <span className={styles.text}>
          <span className={styles.titleLine}>
            <span className={styles.name}>{project.name}</span>{' '}
            <span className={styles.key}>{project.key}</span>
          </span>{' '}
          <span className={styles.description}>{descriptionText(project.description)}</span>
        </span>
      </span>{' '}
      <span className={styles.progress}>
        <span className={styles.track}>
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        </span>
        <span className={styles.percent}>{percent}%</span>
      </span>{' '}
      <span className={styles.counts}>
        <span className={styles.open}>{project.openCount} open</span>{' '}
        {readyCount > 0 && <span className={styles.ready}>{readyCount} ready</span>}
      </span>{' '}
      <span className={styles.updated}>
        <span className="visually-hidden">Updated</span>{' '}
        {formatRelative(project.lastActivityAt, now)}
      </span>
      <Icon icon={ChevronRight} size={20} className={styles.chevron} />
    </ListRow>
  );
}
