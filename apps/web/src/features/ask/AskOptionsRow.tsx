import { modelTakesEffort, type AskOptions } from '@tracker/shared';
import clsx from 'clsx';
import { Gauge } from 'lucide-react';
import { Segmented } from '../../components/Segmented';
import styles from './AskOptionsRow.module.css';
import { askOptionsHint, EFFORT_OPTIONS, MODE_OPTIONS, MODEL_OPTIONS } from './askOptions';
import { EFFORT_LABEL, MODE_LABEL, MODEL_LABEL } from './copy';
import { OptionChip } from './OptionChip';

export interface AskOptionsRowProps {
  options: AskOptions;
  onChange: (change: Partial<AskOptions>) => void;
}

export function AskOptionsRow({ options, onChange }: AskOptionsRowProps) {
  const hint = askOptionsHint(options);
  return (
    <>
      <div className={styles.row}>
        <OptionChip
          label={MODEL_LABEL}
          options={MODEL_OPTIONS}
          value={options.model}
          onChange={(model) => onChange({ model })}
        />
        {/* Hidden, not reset: the effort comes back when another model is picked. */}
        {modelTakesEffort(options.model) && (
          <OptionChip
            label={EFFORT_LABEL}
            icon={Gauge}
            options={EFFORT_OPTIONS}
            value={options.effort}
            onChange={(effort) => onChange({ effort })}
          />
        )}
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
