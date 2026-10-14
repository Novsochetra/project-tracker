import { lineLabel, type LineRef } from '@tracker/shared';
import { useEffect, useRef, useState } from 'react';
import { errorMessage, useAddComment } from '../../../api';
import { AutoTextarea, Button, useToast } from '../../../components';
import { isSubmitShortcut, tooLongMessage } from '../activity/commentRules';
import { COMMENT_MAX_LENGTH } from '../fields/limits';
import { keepLineDraft, lineDraftText } from './lineDrafts';
import styles from './TicketChanges.module.css';

export interface LineCommentBoxProps {
  ticketKey: string;
  line: LineRef;
  lineId: string;
  // A tap opened it; a box that comes back with its draft after a reload takes no focus.
  focus: boolean;
  onClose: () => void;
}

export function LineCommentBox({ ticketKey, line, lineId, focus, onClose }: LineCommentBoxProps) {
  const [text, setText] = useState(() => lineDraftText(ticketKey, lineId));
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const addComment = useAddComment();
  const { show } = useToast();
  useEffect(() => {
    if (focus) inputRef.current?.focus({ preventScroll: true });
  }, [focus]);

  const change = (next: string) => {
    setText(next);
    keepLineDraft(ticketKey, lineId, next);
  };
  const send = () => {
    const sent = text.trim();
    if (!sent) return;
    const tooLong = tooLongMessage(sent);
    if (tooLong) return show(tooLong, { kind: 'error' });
    change('');
    onClose();
    addComment.mutateAsync({ ticketKey, text: sent, line }).catch((error: unknown) => {
      show(errorMessage(error), { kind: 'error' });
      keepLineDraft(ticketKey, lineId, sent);
    });
  };
  return (
    <form
      className={styles.box}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <AutoTextarea
        ref={inputRef}
        aria-label={`Comment on ${lineLabel(line)}`}
        placeholder="Comment on this line…"
        rows={2}
        className={styles.input}
        maxLength={COMMENT_MAX_LENGTH}
        value={text}
        onChange={(event) => change(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (!isSubmitShortcut(event)) return;
          event.preventDefault();
          send();
        }}
      />
      <div className={styles.boxFooter}>
        <Button
          variant="text"
          size="sm"
          onClick={() => {
            change('');
            onClose();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!text.trim()}>
          Comment
        </Button>
      </div>
    </form>
  );
}
