import {
  contextLevel,
  contextPercent,
  CONTEXT_FULL_PERCENT,
  type ChatContext,
} from '@tracker/shared';
import clsx from 'clsx';
import { useId, useState } from 'react';
import styles from './ContextMeter.module.css';
import { chatTokensText, contextLabel, contextUsedText, CONTEXT_FULL_HINT } from './contextCopy';

export function ContextMeter({ context }: { context: ChatContext }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const percent = contextPercent(context);
  const level = contextLevel(percent);
  return (
    <div className={clsx(styles.context, styles[level])}>
      <div className={styles.row}>
        {percent >= CONTEXT_FULL_PERCENT && <p className={styles.hint}>{CONTEXT_FULL_HINT}</p>}
        <button
          type="button"
          className={styles.meter}
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((shown) => !shown)}
        >
          <span aria-hidden="true" className={styles.track}>
            <span className={styles.fill} style={{ width: `${percent}%` }} />
          </span>
          {contextLabel(percent)}
        </button>
      </div>
      <div id={detailsId} hidden={!open} className={styles.details}>
        <p>{contextUsedText(context)}</p>
        <p>{chatTokensText(context.tokens)}</p>
      </div>
    </div>
  );
}
