import type { TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import type { KeyboardEvent } from 'react';
import { DropOverlay, pasteImages, useImageDrop, useImageUploads } from '../../attachments';
import { AutosaveTextarea } from '../fields/AutosaveTextarea';
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '../fields/limits';
import type { MoveToDone } from '../useMoveToDone';
import { useTicketUpdate } from '../useTicketUpdate';
import { LatestReview } from './LatestReview';
import styles from './TicketMain.module.css';
import { TicketImages } from './TicketImages';

export interface TicketMainProps {
  detail: TicketDetail;
  done: MoveToDone | null;
  className?: string | undefined;
}

// A title is one line; Enter while composing (CJK input) still confirms the composition.
function keepOneLine(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
}

export function TicketMain({ detail, done, className }: TicketMainProps) {
  const { ticket } = detail;
  const update = useTicketUpdate(ticket.key);
  const uploads = useImageUploads({ ticketKey: ticket.key });
  const drop = useImageDrop(uploads.add);
  const images = detail.attachments.filter((attachment) => attachment.activityId === null);
  return (
    <div className={clsx(styles.main, className)} {...drop.handlers}>
      <div className={styles.inner}>
        <span className={styles.key}>{ticket.key}</span>
        <AutosaveTextarea
          label="Title"
          target={{ ticketKey: ticket.key, field: 'title' }}
          placeholder="Ticket title"
          className={styles.title}
          maxLength={TITLE_MAX_LENGTH}
          value={ticket.title}
          onKeyDown={keepOneLine}
          onSave={(title) => update({ title })}
        />
        <AutosaveTextarea
          label="Description"
          target={{ ticketKey: ticket.key, field: 'description' }}
          placeholder="Add details, steps or acceptance criteria…"
          className={styles.description}
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={ticket.description}
          onPaste={(event) => pasteImages(event, uploads.add)}
          onSave={(description) => update({ description })}
        />
        <TicketImages ticketKey={ticket.key} images={images} uploads={uploads} />
        <LatestReview detail={detail} done={done} />
      </div>
      {drop.active && <DropOverlay />}
    </div>
  );
}
