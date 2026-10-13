import { Plus } from 'lucide-react';
import { EmptyState } from '../../components';
import styles from './ProjectScreen.module.css';

// No button of its own: New ticket is already in the header on desktop and the nav bar on phones.
export function NoTickets({ projectName }: { projectName: string }) {
  return (
    <EmptyState
      fill
      icon={Plus}
      title="No tickets yet"
      text={`Create the first ticket for ${projectName}.`}
    />
  );
}

// Without a search, only an empty status tab leaves no group to show.
export function NoMatches({ status }: { status?: string | undefined }) {
  return (
    <p className={styles.noMatches}>{status ? `No tickets in ${status}` : 'No tickets match.'}</p>
  );
}
