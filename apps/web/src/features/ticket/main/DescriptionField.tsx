import clsx from 'clsx';
import { useId, useRef, type ClipboardEvent } from 'react';
import { foldedClass, ShowMoreButton, useFold } from '../../../components';
import { useIsPhone } from '../../../lib/media';
import { AutosaveTextarea } from '../fields/AutosaveTextarea';
import { DESCRIPTION_MAX_LENGTH } from '../fields/limits';
import styles from './TicketMain.module.css';

export interface DescriptionFieldProps {
  ticketKey: string;
  value: string;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
}

// On phones a long description folds while it isn't being edited, so the files and the activity
// below it stay near. A tap on it still edits, and opens it for good: folding again when the
// keyboard closed would pull the text just edited away from under the reader.
export function DescriptionField({ ticketKey, value, onPaste }: DescriptionFieldProps) {
  const isPhone = useIsPhone();
  const ref = useRef<HTMLTextAreaElement>(null);
  const fold = useFold(ref, isPhone, value);
  const id = useId();
  return (
    <>
      <AutosaveTextarea
        ref={ref}
        id={id}
        label="Description"
        target={{ ticketKey, field: 'description' }}
        placeholder="Add details, steps or acceptance criteria…"
        className={clsx(styles.description, fold.folded && foldedClass)}
        style={fold.folded && fold.height !== null ? { maxHeight: fold.height } : undefined}
        maxLength={DESCRIPTION_MAX_LENGTH}
        value={value}
        onFocus={fold.expand}
        onPaste={onPaste}
      />
      {fold.height !== null && (
        <ShowMoreButton
          expanded={fold.expanded}
          controls={id}
          className={styles.more}
          onClick={(event) => fold.toggle(event.currentTarget)}
        />
      )}
    </>
  );
}
