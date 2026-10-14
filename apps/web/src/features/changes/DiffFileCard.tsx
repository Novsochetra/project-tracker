import type { DiffFile } from '@tracker/shared';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Icon } from '../../components';
import { STATUS_WORDS } from './copy';
import { DiffHunks, type LineHandlers } from './DiffHunks';
import styles from './DiffView.module.css';

export interface DiffFileCardProps extends LineHandlers {
  file: DiffFile;
  open: boolean;
  onToggle: () => void;
  viewed: boolean;
  onViewedChange?: ((viewed: boolean) => void) | undefined;
}

// A long path wraps after a slash where it can, so a folder's name stays whole on a phone.
const withBreaks = (path: string) =>
  path.split('/').map((part, index, parts) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ));

function FileName({ file }: { file: DiffFile }) {
  const word = STATUS_WORDS[file.status];
  const name = file.status === 'renamed' ? `${file.oldPath} → ${file.path}` : file.path;
  return (
    <span className={styles.name}>
      <span className={styles.path} title={name}>
        {withBreaks(name)}
      </span>
      {word && <span className={styles.status}>{word}</span>}
    </span>
  );
}

function Counts({ file }: { file: DiffFile }) {
  return (
    <>
      <span className={styles.counts} aria-hidden="true">
        <span className={styles.added}>+{file.additions}</span>
        <span className={styles.removed}>−{file.deletions}</span>
      </span>
      <span className="visually-hidden">
        {`, ${file.additions} added, ${file.deletions} removed`}
      </span>
    </>
  );
}

export function DiffFileCard({
  file,
  open,
  onToggle,
  viewed,
  onViewedChange,
  ...lines
}: DiffFileCardProps) {
  return (
    <section className={styles.file} data-viewed={viewed || undefined}>
      <div className={styles.fileHeader}>
        <button type="button" className={styles.toggle} aria-expanded={open} onClick={onToggle}>
          <Icon icon={ChevronRight} size={16} className={styles.chevron} />
          <FileName file={file} />
          <Counts file={file} />
        </button>
        {onViewedChange && (
          <label className={styles.viewed}>
            <input
              type="checkbox"
              aria-label={`Viewed ${file.path}`}
              checked={viewed}
              onChange={(event) => onViewedChange(event.currentTarget.checked)}
            />
            Viewed
          </label>
        )}
      </div>
      {open && <DiffHunks file={file} {...lines} />}
    </section>
  );
}
