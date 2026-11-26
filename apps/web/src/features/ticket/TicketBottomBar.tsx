import { MessageSquare } from 'lucide-react';
import type { RefObject } from 'react';
import { Button } from '../../components';
import { useJustChanged } from '../../lib/useJustChanged';
import { BottomBar } from '../../navigation';
import { DoneButton } from './DoneButton';
import { CommentJump } from './jump/CommentJump';
import { jumpToComment } from './jump/jumpToComment';
import styles from './TicketScreen.module.css';
import type { MoveToDone } from './useMoveToDone';

// Longer than a double tap, whose second tap lands within about 300 ms.
export const PRIMARY_SETTLE_MS = 500;

export interface TicketBottomBarProps {
  // Reviewed work's next step is Done; until then the bar's step is a comment.
  done: MoveToDone | null;
  commentBox: RefObject<HTMLFormElement | null>;
}

export function TicketBottomBar({ done, commentBox }: TicketBottomBarProps) {
  // Move to Done and Comment take turns in one spot, so a tap just after they swap was meant for
  // the other one: the second tap of a double tap on Move to Done would open the keyboard.
  const swapped = useJustChanged(done === null, PRIMARY_SETTLE_MS);
  const unlessSwapped = (action: () => void) => () => {
    if (!swapped) action();
  };

  return (
    <BottomBar>
      {done ? (
        <>
          <CommentJump boxRef={commentBox} />
          <DoneButton
            key="done"
            done={{ ...done, move: unlessSwapped(done.move) }}
            size="bar"
            className={styles.barPrimary}
          />
        </>
      ) : (
        // Named as the jump is, since "Comment" is the comment box's own button.
        <Button
          key="comment"
          variant="primary"
          size="bar"
          icon={MessageSquare}
          aria-label="Go to the comment box"
          className={styles.barPrimary}
          onClick={unlessSwapped(() => jumpToComment(commentBox.current))}
        >
          Comment
        </Button>
      )}
    </BottomBar>
  );
}
