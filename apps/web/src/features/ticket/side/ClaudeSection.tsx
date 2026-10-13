import { formatRelative, type TicketDetail } from '@tracker/shared';
import { ClipboardCheck, MessageCircle, Terminal } from 'lucide-react';
import { ASK_LABEL } from '../../../app/crumbs';
import { useSheets } from '../../../app/sheets/context';
import { Button } from '../../../components';
import { lastReportAt } from '../activity/activityItems';
import { promptSheet, reportSheet } from '../ticketSheets';
import { useAskClaude } from '../useAskClaude';
import styles from './SidePanel.module.css';

export interface ClaudeSectionProps {
  detail: TicketDetail;
  now: number;
  offersDone: boolean;
}

// Reviewed work goes to Done next, so Move to Done stays the screen's only primary button.
export function ClaudeSection({ detail, now, offersDone }: ClaudeSectionProps) {
  const sheets = useSheets();
  const { ticket, project } = detail;
  const askClaude = useAskClaude(ticket.key);
  const reportAt = lastReportAt(detail.activity);
  return (
    <div className={styles.section}>
      <span className={styles.label}>Claude Code</span>
      <Button
        variant={offersDone ? 'secondary' : 'primary'}
        size="lg"
        fullWidth
        icon={Terminal}
        onClick={() => sheets.open(promptSheet(ticket.key))}
      >
        Send to Claude Code
      </Button>
      <Button size="lg" fullWidth icon={MessageCircle} onClick={askClaude}>
        {ASK_LABEL}
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
