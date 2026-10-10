import type { TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import type { KeyboardEvent } from 'react';
import { useIsPhone } from '../../../lib/media';
import { DropOverlay, pasteFiles, useAttachmentUploads, useFileDrop } from '../../attachments';
import { ticketFiles } from '../../attachments/readableFiles';
import { DetailChips } from '../details/DetailChips';
import { AutosaveTextarea } from '../fields/AutosaveTextarea';
import { TITLE_MAX_LENGTH } from '../fields/limits';
import type { MoveToDone } from '../useMoveToDone';
import { DescriptionField } from './DescriptionField';
import { LatestReview } from './LatestReview';
import { LatestRun } from './LatestRun';
import { TicketAttachments } from './TicketAttachments';
import styles from './TicketMain.module.css';

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
  const isPhone = useIsPhone();
  const uploads = useAttachmentUploads({ ticketKey: ticket.key });
  const drop = useFileDrop(uploads.add);
  // This runs outside the error boundaries, so a file entry this app can't read, such as null or
  // one without a type, is left out instead of failing the whole screen.
  const attachments = ticketFiles(detail.attachments);
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
        />
        {isPhone && <DetailChips detail={detail} />}
        {/* Above the description, which often runs long enough to push them below a phone's fold. */}
        <LatestRun ticketKey={ticket.key} />
        <LatestReview detail={detail} done={done} />
        <DescriptionField
          ticketKey={ticket.key}
          value={ticket.description}
          onPaste={(event) => pasteFiles(event, uploads.add)}
        />
        <TicketAttachments ticketKey={ticket.key} attachments={attachments} uploads={uploads} />
      </div>
      {drop.active && <DropOverlay />}
    </div>
  );
}
