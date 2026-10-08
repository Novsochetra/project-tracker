import { ClipboardCheck, Terminal } from 'lucide-react';
import { useSheets } from '../../app/sheets/context';
import { Button } from '../../components';
import { BottomBar } from '../../navigation';
import styles from './TicketScreen.module.css';
import { promptSheet, reportSheet } from './ticketSheets';

export interface TicketBottomBarProps {
  ticketKey: string;
  projectKey: string;
}

export function TicketBottomBar({ ticketKey, projectKey }: TicketBottomBarProps) {
  const sheets = useSheets();
  return (
    <BottomBar>
      <Button
        size="bar"
        icon={ClipboardCheck}
        className={styles.barSecondary}
        onClick={() => sheets.open(reportSheet(ticketKey, projectKey))}
      >
        Paste report
      </Button>
      <Button
        variant="primary"
        size="bar"
        icon={Terminal}
        className={styles.barPrimary}
        onClick={() => sheets.open(promptSheet(ticketKey))}
      >
        Send to Claude
      </Button>
    </BottomBar>
  );
}
