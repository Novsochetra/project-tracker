import { projectDisplayName, type Status } from '@tracker/shared';
import clsx from 'clsx';
import { ArrowRight, Check, ChevronRight } from 'lucide-react';
import { Button, Icon, StarRating, VerdictChip } from '../../components';
import { SwipeActions, type SwipeAction } from '../../gestures';
import { useIsPhone } from '../../lib/media';
import { useIsOpening } from '../../navigation';
import { riseDelay } from '../projects/projectRows';
import type { ReadyItem } from './readyItems';
import styles from './ReadySection.module.css';

export interface ReadyRowProps {
  item: ReadyItem;
  index: number;
  onOpen: (item: ReadyItem) => void;
  onDone: (item: ReadyItem, status: Status) => void;
}

// The row leaves the list, so keyboard users keep their place on the ticket next to it.
function focusNeighbour(from: HTMLElement): void {
  const row = from.closest('[data-ready-row]');
  const neighbour = [row?.nextElementSibling, row?.previousElementSibling].find((element) =>
    element?.hasAttribute('data-ready-row'),
  );
  neighbour?.querySelector<HTMLElement>('button')?.focus();
}

const doneAction = (status: Status, onTrigger: () => void): SwipeAction => ({
  label: status.name,
  icon: <Icon icon={ArrowRight} size={20} />,
  tone: 'accent',
  onTrigger,
});

export function ReadyRow({ item, index, onOpen, onDone }: ReadyRowProps) {
  const isPhone = useIsPhone();
  const done = item.doneStatus;
  const main = <ReadyRowMain item={item} chevron={isPhone} onOpen={() => onOpen(item)} />;
  return (
    <div
      className={clsx(styles.row, 'rise')}
      style={{ animationDelay: `${riseDelay(index)}ms` }}
      data-ready-row=""
    >
      {isPhone ? (
        <SwipeActions
          className={styles.swipe}
          leading={done ? [doneAction(done, () => onDone(item, done))] : []}
        >
          {main}
        </SwipeActions>
      ) : (
        <>
          {main}
          {done && (
            <Button
              size="sm"
              icon={Check}
              className={styles.done}
              aria-label={`Move ${item.ticket.key} to ${done.name}`}
              onClick={(event) => {
                focusNeighbour(event.currentTarget);
                onDone(item, done);
              }}
            >
              {done.name}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

interface ReadyRowMainProps {
  item: ReadyItem;
  chevron: boolean;
  onOpen: () => void;
}

function ReadyRowMain({
  item: { ticket, project, statusColor },
  chevron,
  onOpen,
}: ReadyRowMainProps) {
  const opening = useIsOpening({ name: 'ticket', key: project.key, num: ticket.num });
  return (
    <button
      type="button"
      className={clsx('ring-inside', styles.main)}
      data-opening={opening || undefined}
      onClick={onOpen}
    >
      {/* The spaces keep the parts apart in the accessible name, which starts with the key. */}
      <span className={styles.key}>{ticket.key}</span>{' '}
      <span className={styles.title}>{ticket.title || 'Untitled'}</span>{' '}
      <span className={styles.project}>
        <span className={styles.square} style={{ background: project.color }} aria-hidden="true" />
        <span className={styles.projectName}>{projectDisplayName(project)}</span>
      </span>{' '}
      {ticket.lastReview && (
        <span className={styles.review}>
          <VerdictChip verdict={ticket.lastReview.verdict} approvedColor={statusColor} />{' '}
          <StarRating value={ticket.lastReview.rating} />
        </span>
      )}
      {chevron && <Icon icon={ChevronRight} size={20} className={styles.chevron} />}
    </button>
  );
}
