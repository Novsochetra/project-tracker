import { ClipboardCheck, Terminal } from 'lucide-react';
import { useSheets } from '../../app/sheets/context';
import { Button } from '../../components';
import { useJustChanged } from '../../lib/useJustChanged';
import { BottomBar } from '../../navigation';
import { DoneButton } from './DoneButton';
import styles from './TicketScreen.module.css';
import { promptSheet, reportSheet } from './ticketSheets';
import type { MoveToDone } from './useMoveToDone';

// Longer than a double tap, whose second tap lands within about 300 ms.
const PRIMARY_SETTLE_MS = 500;

export interface TicketBottomBarProps {
  ticketKey: string;
  projectKey: string;
  // Reviewed work's next step is Done, not another round with Claude.
  done: MoveToDone | null;
}

export function TicketBottomBar({ ticketKey, projectKey, done }: TicketBottomBarProps) {
  const sheets = useSheets();
  // Move to Done and Send to Claude take turns in one spot, so a tap just after they swap was
  // meant for the other one: the second tap of a double tap on Move to Done opened Send to Claude.
  const swapped = useJustChanged(done === null, PRIMARY_SETTLE_MS);
  const unlessSwapped = (action: () => void) => () => {
    if (!swapped) action();
  };
  return (
    <BottomBar>
      <Button
        size="bar"
        icon={ClipboardCheck}
        aria-label="Paste report"
        className={styles.barSecondary}
        onClick={() => sheets.open(reportSheet(ticketKey, projectKey))}
      >
        {/* One flex item, so the space before "report" isn't the button's icon gap. */}
        <span>
          Paste<span className={styles.reportWord}> report</span>
        </span>
      </Button>
      {done ? (
        <DoneButton
          key="done"
          done={{ ...done, move: unlessSwapped(done.move) }}
          size="bar"
          className={styles.barPrimary}
        />
      ) : (
        <Button
          key="send"
          variant="primary"
          size="bar"
          icon={Terminal}
          className={styles.barPrimary}
          onClick={unlessSwapped(() => sheets.open(promptSheet(ticketKey)))}
        >
          Send to Claude
        </Button>
      )}
    </BottomBar>
  );
}
