import clsx from 'clsx';
import { useId, useRef, type FocusEvent, type ReactNode } from 'react';
import styles from './Fold.module.css';
import { pastFold } from './pastFold';
import { ShowMoreButton } from './ShowMoreButton';
import { useFold } from './useFold';

export interface FoldProps {
  // Off, the text renders alone, as it always has on desktop.
  enabled: boolean;
  children: ReactNode;
  className?: string | undefined;
}

export function Fold({ enabled, children, className }: FoldProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const fold = useFold(textRef, enabled);
  if (!enabled) return children;
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (fold.folded && pastFold(event.target, event.currentTarget)) fold.expand();
  };
  return (
    <>
      <div
        id={id}
        className={clsx(styles.fold, fold.folded && styles.folded, className)}
        style={fold.folded && fold.height !== null ? { maxHeight: fold.height } : undefined}
        onFocus={onFocus}
      >
        <div ref={textRef} className={styles.text}>
          {children}
        </div>
      </div>
      {fold.height !== null && (
        <ShowMoreButton
          expanded={fold.expanded}
          controls={id}
          className={styles.toggle}
          onClick={(event) => fold.toggle(event.currentTarget)}
        />
      )}
    </>
  );
}
