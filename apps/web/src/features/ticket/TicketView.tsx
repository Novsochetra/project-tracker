import type { TicketDetail } from '@tracker/shared';
import { useRef } from 'react';
import { NavBar, NavBarSpacer } from '../../navigation';
import { ImageViewerProvider } from '../attachments';
import { ActivitySection } from './activity/ActivitySection';
import { TicketMain } from './main/TicketMain';
import { TicketSidePanel } from './side/TicketSidePanel';
import { TicketBottomBar } from './TicketBottomBar';
import styles from './TicketScreen.module.css';
import { useMoveToDone } from './useMoveToDone';

// The Done buttons leave once the ticket moves, so focus goes on to the Status row they changed,
// the first dropdown in the panel.
const focusStatus = (panel: HTMLElement | null) =>
  panel?.querySelector<HTMLElement>('[aria-haspopup="listbox"]')?.focus({ preventScroll: true });

export function TicketView({ detail }: { detail: TicketDetail }) {
  const { ticket, project } = detail;
  const panelRef = useRef<HTMLElement>(null);
  const done = useMoveToDone(detail, () => focusStatus(panelRef.current));
  return (
    <ImageViewerProvider>
      <NavBar title={ticket.key} mono backLabel={project.name} right={<NavBarSpacer />} />
      <div className={styles.grid}>
        <TicketMain detail={detail} done={done} className={styles.main} />
        <TicketSidePanel ref={panelRef} detail={detail} className={styles.side} />
        <ActivitySection detail={detail} className={styles.activity} />
      </div>
      <TicketBottomBar ticketKey={ticket.key} projectKey={project.key} done={done} />
    </ImageViewerProvider>
  );
}
