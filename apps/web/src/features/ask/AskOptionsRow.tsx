import type { AskOptions } from '@tracker/shared';
import clsx from 'clsx';
import { Segmented } from '../../components/Segmented';
import styles from './AskOptionsRow.module.css';
import { askOptionsHint, MODE_OPTIONS } from './askOptions';
import { MODE_LABEL } from './copy';
import { ModelChip } from './ModelChip';

export interface AskOptionsRowProps {
  options: AskOptions;
  onChange: (change: Partial<AskOptions>) => void;
}

export function AskOptionsRow({ options, onChange }: AskOptionsRowProps) {
  const hint = askOptionsHint(options);
  return (
    <>
      <div className={styles.row}>
        <ModelChip value={options.model} onChange={(model) => onChange({ model })} />
        <div className={styles.mode}>
          <Segmented
            aria-label={MODE_LABEL}
            options={MODE_OPTIONS}
            value={options.mode}
            onChange={(mode) => onChange({ mode })}
          />
        </div>
      </div>
      {hint && <p className={clsx(styles.hint, 'fade-in')}>{hint}</p>}
    </>
  );
}
