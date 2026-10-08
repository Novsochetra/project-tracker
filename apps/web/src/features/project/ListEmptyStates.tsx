import { Plus } from 'lucide-react';
import { Button, EmptyState } from '../../components';
import styles from './ProjectScreen.module.css';

export function NoTickets({ projectName, onAdd }: { projectName: string; onAdd: () => void }) {
  return (
    <EmptyState
      icon={Plus}
      title="No tickets yet"
      text={`Create the first ticket for ${projectName}.`}
      action={
        <Button variant="primary" className={styles.emptyAction} onClick={onAdd}>
          New ticket
        </Button>
      }
    />
  );
}

// Without a search, only an empty status tab leaves no group to show.
export function NoMatches({ status }: { status?: string | undefined }) {
  return (
    <p className={styles.noMatches}>{status ? `No tickets in ${status}` : 'No tickets match.'}</p>
  );
}
