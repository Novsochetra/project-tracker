import type { TicketDetail } from '@tracker/shared';
import { useRef } from 'react';
import { useIsPhone } from '../../lib/media';
import { NavBar, NavBarSpacer } from '../../navigation';
import { AttachmentViewerProvider } from '../attachments';
import { ActivitySection } from './activity/ActivitySection';
import { TicketMain } from './main/TicketMain';
import { TicketFooter } from './side/TicketFooter';
import { TicketSidePanel } from './side/TicketSidePanel';
import { TicketBottomBar } from './TicketBottomBar';
import styles from './TicketScreen.module.css';
import { useMoveToDone } from './useMoveToDone';

// The Done buttons leave once the ticket moves, so focus goes on to the Status it changed: the
// screen's first dropdown, the phone's Status chip or the side panel's Status row.
const focusStatus = (screen: HTMLElement | null) =>
  screen?.querySelector<HTMLElement>('[aria-haspopup="listbox"]')?.focus({ preventScroll: true });

export function TicketView({ detail }: { detail: TicketDetail }) {
  const { ticket, project } = detail;
  const isPhone = useIsPhone();
  const gridRef = useRef<HTMLDivElement>(null);
  const commentBox = useRef<HTMLFormElement>(null);
  const done = useMoveToDone(detail, () => focusStatus(gridRef.current));
  return (
    <AttachmentViewerProvider>
      <NavBar title={ticket.key} mono backLabel={project.name} right={<NavBarSpacer />} />
      <div ref={gridRef} className={styles.grid}>
        {/* Phones move to Done from the bottom bar only, so the review card keeps no button. */}
        <TicketMain detail={detail} done={isPhone ? null : done} className={styles.main} />
        {!isPhone && (
          <TicketSidePanel detail={detail} offersDone={done !== null} className={styles.side} />
        )}
        <ActivitySection detail={detail} composerRef={commentBox} className={styles.activity} />
        {isPhone && <TicketFooter detail={detail} className={styles.foot} />}
      </div>
      <TicketBottomBar
        ticketKey={ticket.key}
        projectKey={project.key}
        done={done}
        commentBox={commentBox}
      />
    </AttachmentViewerProvider>
  );
}
