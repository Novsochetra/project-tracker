import { actorLabel, type Activity, type LineRef } from '@tracker/shared';
import { isTemporaryId } from '../../../api';
import { ActivityCard, ActorAvatar } from '../activity/ActivityCard';
import cardStyles from '../activity/ActivityCard.module.css';
import { LinkedText } from '../activity/LinkedText';
import { TimeAgo } from '../activity/TimeAgo';
import { LineCommentBox } from './LineCommentBox';
import styles from './TicketChanges.module.css';

export interface LineThreadProps {
  ticketKey: string;
  line: LineRef;
  lineId: string;
  comments: readonly Activity[];
  boxOpen: boolean;
  focus: boolean;
  now: number;
  onClose: () => void;
}

export function LineThread({ comments, boxOpen, now, ...box }: LineThreadProps) {
  if (comments.length === 0 && !boxOpen) return null;
  return (
    <div className={styles.thread}>
      {comments.map((comment) => (
        <ActivityCard
          key={comment.id}
          avatar={<ActorAvatar actor={comment.actor} />}
          title={actorLabel(comment.actor)}
          meta={<TimeAgo at={comment.createdAt} now={now} />}
          dimmed={isTemporaryId(comment.id)}
          className={styles.comment}
        >
          <p className={cardStyles.body}>
            <LinkedText text={comment.text} />
          </p>
        </ActivityCard>
      ))}
      {boxOpen && <LineCommentBox {...box} />}
    </div>
  );
}
