import clsx from 'clsx';
import { Fragment } from 'react';
import styles from './ProjectCard.module.css';
import { progressParts, type ProjectProgress } from './projectProgress';

export function ProjectProgressBar({ progress }: { progress: ProjectProgress }) {
  return (
    <span className={styles.progress}>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fills}>
          <span className={styles.doneFill} style={{ width: `${progress.doneShare}%` }} />
          <span className={styles.readyFill} style={{ width: `${progress.readyShare}%` }} />
        </span>
      </span>{' '}
      <span className={styles.percent}>{progress.percent}%</span>
    </span>
  );
}

const DOTS = { done: styles.doneDot, ready: styles.readyDot, open: undefined };

export function ProjectProgressParts({ progress }: { progress: ProjectProgress }) {
  const parts = progressParts(progress);
  if (parts.length === 0) return <span className={styles.parts}>No tickets</span>;
  return (
    <span className={styles.parts}>
      {parts.map(({ kind, count }, index) => (
        <Fragment key={kind}>
          {index > 0 && ' '}
          <span className={styles.part}>
            {DOTS[kind] && <span className={clsx(styles.dot, DOTS[kind])} aria-hidden="true" />}
            {count} {kind}
          </span>
        </Fragment>
      ))}
    </span>
  );
}
