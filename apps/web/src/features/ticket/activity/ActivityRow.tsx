import type { Status } from '@tracker/shared';
import { ErrorBoundary } from '../../../lib/ErrorBoundary';
import type { ActivityItem } from './activityItems';
import type { RiseProps } from './ActivityCard';
import { CommentCard } from './CommentCard';
import { EventLine } from './EventLine';
import { ReportCard } from './ReportCard';
import { ReviewCard } from './ReviewCard';
import { UnshownComment, UnshownItem } from './UnshownItem';
import type { ActivityActions } from './useActivityActions';
import { useCommentEdit } from './useCommentEdit';

type CommentItem = Extract<ActivityItem, { kind: 'comment' }>;
type OtherItem = Exclude<ActivityItem, CommentItem>;

interface RowContext {
  now: number;
  actions: ActivityActions;
  rise: RiseProps;
  approvedColor: string | undefined;
  statuses: readonly Status[];
}

export interface ActivityRowProps extends RowContext {
  item: ActivityItem;
}

// An item that fails to render stands in as its plain text with its menu, and the rest of the
// ticket stays usable. It is tried again once its activity changes, as after an edit saves.
export function ActivityRow({ item, ...context }: ActivityRowProps) {
  if (item.kind === 'comment') return <CommentRow item={item} {...context} />;
  return (
    <ErrorBoundary
      name={`Activity item ${item.id}`}
      retryKey={item.source}
      fallback={<UnshownItem item={item} actions={context.actions} />}
    >
      <ItemCard item={item} {...context} />
    </ErrorBoundary>
  );
}

// The edit lives outside the boundary, so the card and its stand-in share it, and it survives the
// switch between them. The card is only tried again once the edit is closed: switching under an
// open editor would take its focus.
function CommentRow({ item, now, actions, rise }: RowContext & { item: CommentItem }) {
  const edit = useCommentEdit(item, actions.editComment, actions.ticketKey);
  return (
    <ErrorBoundary
      name={`Activity item ${item.id}`}
      retryKey={item.source}
      holdRetry={edit.open}
      fallback={<UnshownComment item={item} edit={edit} actions={actions} />}
    >
      <CommentCard item={item} edit={edit} now={now} actions={actions} rise={rise} />
    </ErrorBoundary>
  );
}

function ItemCard(props: RowContext & { item: OtherItem }) {
  const { item, now, actions, rise, approvedColor, statuses } = props;
  switch (item.kind) {
    case 'event':
      return <EventLine item={item} now={now} rise={rise} />;
    case 'report':
      return <ReportCard item={item} now={now} actions={actions} rise={rise} statuses={statuses} />;
    case 'review':
      return (
        <ReviewCard
          item={item}
          now={now}
          actions={actions}
          rise={rise}
          approvedColor={approvedColor}
        />
      );
    case 'unknown':
      return <UnshownItem item={item} actions={actions} />;
  }
}
