import type { TicketDetail } from '@tracker/shared';
import { NavBar, NavBarSpacer } from '../../navigation';
import { ImageViewerProvider } from '../attachments';
import { ActivitySection } from './activity/ActivitySection';
import { TicketMain } from './main/TicketMain';
import { TicketSidePanel } from './side/TicketSidePanel';
import { TicketBottomBar } from './TicketBottomBar';
import styles from './TicketScreen.module.css';

export function TicketView({ detail }: { detail: TicketDetail }) {
  const { ticket, project } = detail;
  return (
    <ImageViewerProvider>
      <NavBar title={ticket.key} mono backLabel={project.name} right={<NavBarSpacer />} />
      <div className={styles.grid}>
        <TicketMain detail={detail} className={styles.main} />
        <TicketSidePanel detail={detail} className={styles.side} />
        <ActivitySection detail={detail} className={styles.activity} />
      </div>
      <TicketBottomBar ticketKey={ticket.key} projectKey={project.key} />
    </ImageViewerProvider>
  );
}
