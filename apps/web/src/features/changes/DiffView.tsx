import type { DiffFile } from '@tracker/shared';
import { useState, type ReactNode } from 'react';
import { DiffFileCard } from './DiffFileCard';
import { isViewed, type LineAt } from './diffLines';
import styles from './DiffView.module.css';

export interface DiffViewProps {
  files: readonly DiffFile[];
  viewed?: Readonly<Record<string, string>>;
  onViewedChange?: ((file: DiffFile, viewed: boolean) => void) | undefined;
  onLineSelect?: ((file: DiffFile, at: LineAt) => void) | undefined;
  belowLine?: ((file: DiffFile, at: LineAt) => ReactNode) | undefined;
}

const toggled = (open: ReadonlySet<string>, path: string, on: boolean): ReadonlySet<string> => {
  const next = new Set(open);
  if (on) next.add(path);
  else next.delete(path);
  return next;
};

// Ticking a file as viewed closes it: the person is done with it.
export function DiffView({
  files,
  viewed = {},
  onViewedChange,
  onLineSelect,
  belowLine,
}: DiffViewProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  return (
    <ul className={styles.files} aria-label="Changed files">
      {files.map((file) => (
        <li key={file.path}>
          <DiffFileCard
            file={file}
            open={open.has(file.path)}
            onToggle={() => setOpen((now) => toggled(now, file.path, !now.has(file.path)))}
            viewed={isViewed(file, viewed)}
            onViewedChange={
              onViewedChange &&
              ((next) => {
                if (next) setOpen((now) => toggled(now, file.path, false));
                onViewedChange(file, next);
              })
            }
            onLineSelect={onLineSelect && ((at) => onLineSelect(file, at))}
            belowLine={belowLine && ((at) => belowLine(file, at))}
          />
        </li>
      ))}
    </ul>
  );
}
