import clsx from 'clsx';
import { ListPlus } from 'lucide-react';
import type { MouseEvent } from 'react';
import { errorMessage } from '../../api';
import { Button } from '../../components';
import { holdPresses } from '../../lib/holdPresses';
import { canCreate, type IndexedCard } from './cards';
import styles from './TicketCard.module.css';
import type { CreateAll } from './useCreateAll';

export interface CreateAllButtonProps {
  pending: readonly IndexedCard[];
  createAll: CreateAll;
}

export function CreateAllButton({ pending, createAll }: CreateAllButtonProps) {
  const ready = pending.every(({ card }) => canCreate(card));
  // The made cards' Run buttons take this place, so a double tap's second tap must not press one.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail !== 0) holdPresses(event.currentTarget);
    void createAll.run(pending);
  };
  return (
    <div className={styles.createAll}>
      {createAll.error !== null && (
        <p role="alert" className={clsx(styles.error, 'fade-in')}>
          {errorMessage(createAll.error)}
        </p>
      )}
      <Button
        variant="primary"
        size="lg"
        icon={ListPlus}
        className={styles.action}
        disabled={!ready || createAll.busy}
        onClick={onClick}
      >
        Create all
      </Button>
    </div>
  );
}
