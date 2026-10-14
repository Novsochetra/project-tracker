import { projectDisplayName, type TicketDetail } from '@tracker/shared';
import { useRef } from 'react';
import { useIsPhone } from '../../lib/media';
import { NavBar, NavBarSpacer } from '../../navigation';
import { AttachmentViewerProvider } from '../attachments/AttachmentViewerProvider';
import { ActivitySection } from './activity/ActivitySection';
import { TicketChanges } from './changes/TicketChanges';
import { TicketTabs } from './changes/TicketTabs';
import { useChangesTab } from './changes/useChangesTab';
import { TicketMain } from './main/TicketMain';
import { TicketFooter } from './side/TicketFooter';
import { TicketSidePanel } from './side/TicketSidePanel';
import { TicketBottomBar } from './TicketBottomBar';
import styles from './TicketScreen.module.css';
import { useMoveToDone } from './useMoveToDone';

// The Done buttons leave once the ticket moves, so focus goes on to the Status it changed: the
// screen's first dropdown, the phone's Status chip or the side panel's Status row. A cancelled
// run's card leaves too and sends focus there as well, rather than to a text field, which would
// open a phone's keyboard.
const focusStatus = (screen: HTMLElement | null) =>
  screen?.querySelector<HTMLElement>('[aria-haspopup="listbox"]')?.focus({ preventScroll: true });

export function TicketView({ detail }: { detail: TicketDetail }) {
  const { ticket, project } = detail;
  const isPhone = useIsPhone();
  const gridRef = useRef<HTMLDivElement>(null);
  const commentBox = useRef<HTMLFormElement>(null);
  const toStatus = () => focusStatus(gridRef.current);
  const done = useMoveToDone(detail, toStatus);
  const changes = useChangesTab(ticket.key);
  return (
    <AttachmentViewerProvider>
      <NavBar
        title={ticket.key}
        mono
        backLabel={projectDisplayName(project)}
        right={<NavBarSpacer />}
      />
      <div ref={gridRef} className={styles.grid}>
        {changes.changes && (
          <TicketTabs
            value={changes.tab}
            fileCount={changes.files.length}
            onChange={changes.setTab}
            className={styles.tabs}
          />
        )}
        {changes.changes && changes.tab === 'changes' ? (
          <TicketChanges
            detail={detail}
            changes={changes.changes}
            files={changes.files}
            className={styles.main}
          />
        ) : (
          <>
            {/* Phones move to Done from the bottom bar only, so the review card keeps no button. */}
            <TicketMain
              detail={detail}
              done={isPhone ? null : done}
              onRunCancelled={toStatus}
              className={styles.main}
            />
            <ActivitySection detail={detail} composerRef={commentBox} className={styles.activity} />
            {isPhone && <TicketFooter detail={detail} className={styles.foot} />}
          </>
        )}
        {!isPhone && (
          <TicketSidePanel detail={detail} offersDone={done !== null} className={styles.side} />
        )}
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
