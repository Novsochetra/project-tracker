import { Segmented } from '../../../components/Segmented';
import styles from './TicketChanges.module.css';

export type TicketTab = 'ticket' | 'changes';

export interface TicketTabsProps {
  value: TicketTab;
  fileCount: number;
  onChange: (tab: TicketTab) => void;
  className?: string | undefined;
}

export function TicketTabs({ value, fileCount, onChange, className }: TicketTabsProps) {
  return (
    <div className={className}>
      <Segmented
        aria-label="Ticket view"
        options={[
          { value: 'ticket', label: 'Ticket' },
          { value: 'changes', label: 'Changes', count: fileCount },
        ]}
        value={value}
        onChange={onChange}
        className={styles.tabs}
      />
    </div>
  );
}
