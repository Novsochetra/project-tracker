import type { ReportPreviewItem } from '@tracker/shared';
import clsx from 'clsx';
import { useId } from 'react';
import { previewRow } from './pasteReport';
import styles from './ReportSheet.module.css';

export function ChangesPreview({ items }: { items: readonly ReportPreviewItem[] }) {
  const labelId = useId();
  return (
    <div className={clsx(styles.changes, 'fade-in')}>
      <span id={labelId} className={styles.changesLabel}>
        Changes
      </span>
      <ul className={styles.changeList} aria-labelledby={labelId}>
        {items.map((item, index) => {
          const row = previewRow(item);
          return (
            // Blocks have no ids and the whole list is rebuilt from each preview.
            <li key={index} className={styles.change}>
              <span className={styles.changeKey}>{row.keyLabel}</span>
              <span className={styles.changeTitle}>{row.title}</span>
              <span className={clsx(styles.outcome, row.skipped && styles.skipped)}>
                {row.outcome}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
