import { collapseGroup, DEFAULT_STATUSES, type Status } from '@tracker/shared';
import { useId, useRef, useState } from 'react';
import { ListCard, StatusGlyph } from '../../components';
import { useNavigation } from '../../navigation';
import { HeaderShowLess, ShowMoreButton } from '../project/GroupParts';
import { useStatusChange } from '../project/rowEdits';
import { useGroupToggle } from '../project/useGroupToggle';
import type { ReadyItem } from './readyItems';
import { ReadyRow } from './ReadyRow';
import styles from './ReadySection.module.css';

// Tickets come from many projects, so the heading uses the default Reviewed look.
const REVIEWED = DEFAULT_STATUSES.find((status) => status.category === 'reviewed');

export function ReadySection({ items }: { items: readonly ReadyItem[] }) {
  const headingId = useId();
  // The header tops the card, and once the card has collapsed it no longer sticks.
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const toggle = useGroupToggle(ref, expanded, () => setExpanded((value) => !value));
  const { push } = useNavigation();
  const changeStatus = useStatusChange();
  if (items.length === 0) return null;
  const { shown, hiddenCount, hasToggle } = collapseGroup(items, { expanded, searching: false });
  const unfolded = expanded && hasToggle;
  const open = ({ project, ticket }: ReadyItem) =>
    push({ name: 'ticket', key: project.key, num: ticket.num });
  const done = ({ ticket }: ReadyItem, status: Status) => changeStatus(ticket, status);
  return (
    <ListCard
      as="section"
      variant="group"
      className={styles.card}
      aria-labelledby={headingId}
      data-expanded={unfolded || undefined}
    >
      <div ref={ref} className={styles.header}>
        {REVIEWED && <StatusGlyph category="reviewed" color={REVIEWED.color} animated={false} />}
        <h2 id={headingId} className={styles.heading}>
          Ready for you
        </h2>{' '}
        <span className={styles.count}>{items.length}</span>
        {unfolded && (
          <HeaderShowLess name="Ready for you" onClick={toggle} className={styles.less} />
        )}
      </div>
      {shown.map((item, index) => (
        <ReadyRow key={item.ticket.id} item={item} index={index} onOpen={open} onDone={done} />
      ))}
      {hasToggle && (
        <ShowMoreButton expanded={expanded} hiddenCount={hiddenCount} onToggle={toggle} />
      )}
    </ListCard>
  );
}
