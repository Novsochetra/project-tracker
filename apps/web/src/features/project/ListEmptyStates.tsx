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

export function NoMatches() {
  return <p className={styles.noMatches}>No tickets match.</p>;
}
