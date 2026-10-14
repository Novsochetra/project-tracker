import { openNotReviewed, projectDisplayName, type ProjectSummary } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Icon, ListRow } from '../../components';
import { useIsOpening } from '../../navigation';
import styles from './ProjectList.module.css';
import { descriptionText, riseDelay } from './projectRows';

interface ProjectRowProps {
  project: ProjectSummary;
  readyCount: number;
  index: number;
  onOpen: () => void;
}

export function ProjectRow({ project, readyCount, index, onOpen }: ProjectRowProps) {
  const opening = useIsOpening({ name: 'project', key: project.key });
  return (
    <ListRow
      className={clsx(styles.row, 'rise')}
      style={{ animationDelay: `${riseDelay(index)}ms` }}
      data-opening={opening || undefined}
      onClick={onOpen}
    >
      <span className={styles.main}>
        <span className={styles.square} style={{ background: project.color }} aria-hidden="true" />
        <span className={styles.text}>
          <span className={styles.titleLine}>
            <span className={styles.name}>{projectDisplayName(project)}</span>{' '}
            {!project.hideName && <span className={styles.key}>{project.key}</span>}
          </span>{' '}
          <span className={styles.description}>{descriptionText(project)}</span>
        </span>
      </span>{' '}
      <span className={styles.counts}>
        <span className={styles.open}>{openNotReviewed(project.openCount, readyCount)} open</span>{' '}
        {readyCount > 0 && <span className={styles.ready}>{readyCount} ready</span>}
      </span>
      <Icon icon={ChevronRight} size={20} className={styles.chevron} />
    </ListRow>
  );
}
