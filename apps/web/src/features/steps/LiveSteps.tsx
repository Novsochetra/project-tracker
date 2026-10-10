import { useId, useState } from 'react';
import { ShowMoreButton } from '../../components';
import { earlierLabel, HIDE_EARLIER_LABEL, notKeptText } from './stepCopy';
import { StepList } from './StepList';
import { useLeavingRows } from './useLeavingRows';
import styles from './Steps.module.css';
import type { StepRow } from './stepRows';
import { visibleSteps } from './visibleSteps';

export function LiveSteps({ rows }: { rows: StepRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const visible = visibleSteps(rows, expanded);
  const { leaving, onLeft } = useLeavingRows(visible.shown);
  return (
    <div className={styles.steps}>
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
      <StepList
        id={id}
        rows={visible.shown}
        variant="live"
        whole={expanded}
        leaving={leaving}
        onLeft={onLeft}
      />
    </div>
  );
}
