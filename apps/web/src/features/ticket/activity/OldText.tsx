import { useId, useState } from 'react';
import { ShowMoreButton } from '../../../components';
import styles from './ActivitySection.module.css';

// The description an agent's edit replaced (PT-276) stays folded: it can run to 50,000 characters.
export function OldText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={styles.replaced}>
      <ShowMoreButton
        expanded={open}
        moreLabel="Show the old description"
        lessLabel="Hide the old description"
        controls={id}
        onClick={() => setOpen((value) => !value)}
      />
      <span id={id} className={styles.oldText} hidden={!open}>
        {text}
      </span>
    </span>
  );
}
