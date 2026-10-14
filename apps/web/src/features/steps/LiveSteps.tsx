import { useId, useRef, useState } from 'react';
import { ShowMoreButton } from '../../components';
import { earlierLabel, HIDE_EARLIER_LABEL, notKeptText } from './stepCopy';
import { StepList } from './StepList';
import styles from './Steps.module.css';
import type { StepRow } from './stepRows';
import { useFoldLeaving } from './useFoldLeaving';
import { useLeavingRows } from './useLeavingRows';
import { visibleSteps } from './visibleSteps';

export interface LiveStepsProps {
  rows: StepRow[];
  hideTodos?: boolean;
}

export function LiveSteps({ rows, hideTodos = false }: LiveStepsProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const visible = visibleSteps(rows, expanded, { hideTodos });
  const { leaving, onLeft } = useLeavingRows(visible.shown);
  useFoldLeaving(ref, leaving, onLeft);
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
      <StepList id={id} rows={visible.shown} variant="live" leaving={leaving} />
    </div>
  );
}
