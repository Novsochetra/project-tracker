import type { QueuedMessage } from '@tracker/shared';
import { useState } from 'react';
import { Button } from '../../../components';
import styles from '../ChatScreen.module.css';
import { MessageAttachments } from '../messageFiles/MessageAttachments';
import { MessageText } from '../MessageText';
import { EDIT_LABEL, HELD_LABEL, QUEUED_LABEL, REMOVE_LABEL, SEND_NOW_LABEL } from './copy';
import queue from './Queue.module.css';
import { QueuedEditor } from './QueuedEditor';
import { useQueuedActions } from './useQueuedActions';

export interface QueuedItemProps {
  chatId: string;
  message: QueuedMessage;
  // Claude is answering, so Send now would be refused.
  waits: boolean;
}

export function QueuedItem({ chatId, message, waits }: QueuedItemProps) {
  const [editing, setEditing] = useState(false);
  const actions = useQueuedActions(chatId, message.id);
  return (
    <li className={`${styles.item} rise`}>
      <article className={styles.personMessage} aria-label={`${QUEUED_LABEL}: ${message.text}`}>
        <MessageAttachments attachments={message.attachments} from="person" />
        {editing ? (
          <QueuedEditor
            text={message.text}
            busy={actions.busy}
            onSave={(text) => actions.edit(text, () => setEditing(false))}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className={`${styles.person} ${queue.waiting}`}>
            <MessageText text={message.text} />
          </div>
        )}
        <div className={queue.actions}>
          <span className={queue.label}>{message.held ? HELD_LABEL : QUEUED_LABEL}</span>
          {!waits && (
            <Button variant="text" size="sm" disabled={actions.busy} onClick={actions.sendNow}>
              {SEND_NOW_LABEL}
            </Button>
          )}
          {!editing && (
            <Button
              variant="text"
              size="sm"
              disabled={actions.busy}
              onClick={() => setEditing(true)}
            >
              {EDIT_LABEL}
            </Button>
          )}
          <Button variant="text" size="sm" disabled={actions.busy} onClick={actions.remove}>
            {REMOVE_LABEL}
          </Button>
        </div>
      </article>
    </li>
  );
}
