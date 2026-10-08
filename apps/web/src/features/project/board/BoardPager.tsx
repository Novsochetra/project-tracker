import type { TicketGroupData } from '../buildGroups';
import styles from './Board.module.css';

export interface BoardPagerProps {
  columns: readonly TicketGroupData[];
  page: number;
}

export function BoardPager({ columns, page }: BoardPagerProps) {
  const current = columns[page];
  if (!current) return null;
  // The columns are labelled regions already; this only mirrors the scroll position.
  return (
    <div className={styles.pager} aria-hidden="true" data-board-pager="">
      <span className={styles.pagerLabel}>
        <span className={styles.pagerName}>{current.status.name}</span>{' '}
        <span className={styles.pagerCount}>
          {page + 1} / {columns.length}
        </span>
      </span>
      <span className={styles.dots}>
        {columns.map((column, index) => (
          <span
            key={column.status.id}
            className={styles.dot}
            data-current={index === page || undefined}
          />
        ))}
      </span>
    </div>
  );
}
