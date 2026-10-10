import { useId, useRef, useState } from 'react';
import { ShowMoreButton } from '../../components';
import { earlierLabel, HIDE_EARLIER_LABEL, notKeptText } from './stepCopy';
import { StepList } from './StepList';
import { useGentleShrink } from './useGentleShrink';
import styles from './Steps.module.css';
import type { StepRow } from './stepRows';
import { visibleSteps } from './visibleSteps';

export function LiveSteps({ rows }: { rows: StepRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const visible = visibleSteps(rows, expanded);
  const ref = useRef<HTMLDivElement>(null);
  useGentleShrink(ref, `${rows.at(-1)?.seq ?? 0}:${expanded}`);
  return (
    <div ref={ref} className={styles.steps}>
      {visible.canExpand && (
        <ShowMoreButton
          expanded={expanded}
          controls={id}
          moreLabel={earlierLabel(visible.earlier)}
          lessLabel={HIDE_EARLIER_LABEL}
          className={styles.toggle}
          onClick={() => setExpanded(!expanded)}
        />
      )}
      {expanded && visible.notKept > 0 && (
        <p className={styles.note}>{notKeptText(visible.notKept)}</p>
      )}
      <StepList id={id} rows={visible.shown} variant="live" />
    </div>
  );
}
