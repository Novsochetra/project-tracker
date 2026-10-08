import { formatRelative, type TicketDetail } from '@tracker/shared';
import { ClipboardCheck, Terminal } from 'lucide-react';
import { useSheets } from '../../../app/sheets/context';
import { Button } from '../../../components';
import { lastReportAt } from '../activity/activityItems';
import { promptSheet, reportSheet } from '../ticketSheets';
import styles from './SidePanel.module.css';

export function ClaudeSection({ detail, now }: { detail: TicketDetail; now: number }) {
  const sheets = useSheets();
  const { ticket, project } = detail;
  const reportAt = lastReportAt(detail.activity);
  return (
    <div className={styles.section}>
      <span className={styles.label}>Claude Code</span>
      <Button
        variant="primary"
        size="lg"
        fullWidth
        icon={Terminal}
        onClick={() => sheets.open(promptSheet(ticket.key))}
      >
        Send to Claude Code
      </Button>
      <Button
        size="lg"
        fullWidth
        icon={ClipboardCheck}
        onClick={() => sheets.open(reportSheet(ticket.key, project.key))}
      >
        Paste report
      </Button>
      {reportAt !== null && (
        <span className={styles.note}>Last report {formatRelative(reportAt, now)}</span>
      )}
    </div>
  );
}
