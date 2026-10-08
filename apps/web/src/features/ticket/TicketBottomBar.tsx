import { ClipboardCheck, Terminal } from 'lucide-react';
import { useSheets } from '../../app/sheets/context';
import { Button } from '../../components';
import { BottomBar } from '../../navigation';
import { DoneButton } from './DoneButton';
import styles from './TicketScreen.module.css';
import { promptSheet, reportSheet } from './ticketSheets';
import type { MoveToDone } from './useMoveToDone';

export interface TicketBottomBarProps {
  ticketKey: string;
  projectKey: string;
  // Reviewed work's next step is Done, not another round with Claude.
  done: MoveToDone | null;
}

export function TicketBottomBar({ ticketKey, projectKey, done }: TicketBottomBarProps) {
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
      {done ? (
        <DoneButton key="done" done={done} size="bar" className={styles.barPrimary} />
      ) : (
        <Button
          key="send"
          variant="primary"
          size="bar"
          icon={Terminal}
          className={styles.barPrimary}
          onClick={() => sheets.open(promptSheet(ticketKey))}
        >
          Send to Claude
        </Button>
      )}
    </BottomBar>
  );
}
