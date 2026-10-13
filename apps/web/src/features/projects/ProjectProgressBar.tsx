import clsx from 'clsx';
import { Fragment } from 'react';
import styles from './ProjectCard.module.css';
import { progressParts, type ProjectProgress } from './projectProgress';

interface ProgressProps {
  progress: ProjectProgress;
  readyColor: string | undefined;
}

export function ProjectProgressBar({ progress, readyColor }: ProgressProps) {
  return (
    <span className={styles.progress}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fills}>
          <span className={styles.doneFill} style={{ width: `${progress.doneShare}%` }} />
          <span
            className={styles.readyFill}
            style={{ width: `${progress.readyShare}%`, background: readyColor }}
          />
        </span>
      </span>{' '}
      {progress.total > 0 && <span className={styles.percent}>{progress.percent}%</span>}
    </span>
  );
}

const DOT_CLASSES = { done: styles.doneDot, ready: styles.readyDot, open: undefined };

export function ProjectProgressParts({ progress, readyColor }: ProgressProps) {
  const parts = progressParts(progress);
  if (parts.length === 0) return <span className={styles.parts}>No tickets</span>;
  return (
    <span className={styles.parts}>
      {parts.map(({ kind, count }, index) => (
        <Fragment key={kind}>
          {index > 0 && ' '}
          <span className={styles.part}>
            {DOT_CLASSES[kind] && (
              <span
                className={clsx(styles.dot, DOT_CLASSES[kind])}
                style={kind === 'ready' ? { background: readyColor } : undefined}
                aria-hidden="true"
              />
            )}
            {count} {kind}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
