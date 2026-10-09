import clsx from 'clsx';
import { CircleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { errorMessage, isNotFound, useTicket } from '../../api';
import { Button, EmptyState, Spinner } from '../../components';
import { forgetTicketDrafts } from '../../lib/storedDrafts';
import { useNavigation } from '../../navigation';
import { useTicketOnScreen } from './drafts/liveDrafts';
import { TicketLoadingBar } from './TicketLoadingBar';
import styles from './TicketScreen.module.css';
import { TicketView } from './TicketView';

export interface TicketScreenProps {
  projectKey: string;
  num: number;
}

export function TicketScreen({ projectKey, num }: TicketScreenProps) {
  const ticketKey = `${projectKey}-${num}`.toUpperCase();
  const query = useTicket(ticketKey);
  useTicketOnScreen(ticketKey);
  useLeaveWhenMissing(query.error, ticketKey, projectKey);
  if (query.data) return <TicketView detail={query.data} />;
  return (
    <TicketPlaceholder
      ticketKey={ticketKey}
      projectKey={projectKey}
      num={num}
      error={query.error}
      onRetry={() => void query.refetch()}
    />
  );
}

// An unknown or deleted ticket falls back to its project (SPEC §3). Text kept for a ticket
// deleted elsewhere has nothing left to save into.
function useLeaveWhenMissing(error: Error | null, ticketKey: string, projectKey: string) {
  const { replace } = useNavigation();
  const missing = isNotFound(error);
  useEffect(() => {
    if (!missing) return;
    forgetTicketDrafts(ticketKey);
    replace({ name: 'project', key: projectKey });
  }, [missing, ticketKey, projectKey, replace]);
}

interface TicketPlaceholderProps {
  ticketKey: string;
  projectKey: string;
  num: number;
  error: Error | null;
  onRetry: () => void;
}

function TicketPlaceholder({ ticketKey, projectKey, num, error, onRetry }: TicketPlaceholderProps) {
  const failed = error !== null && !isNotFound(error);
  return (
    <>
      <TicketLoadingBar projectKey={projectKey} num={num} />
      {failed ? (
        <EmptyState
          icon={CircleAlert}
          title={`Couldn't load ${ticketKey}`}
          text={errorMessage(error)}
          action={<Button onClick={onRetry}>Try again</Button>}
        />
      ) : (
        <div className={clsx(styles.loading, 'quiet-in')}>
          <Spinner label={`Loading ${ticketKey}`} />
        </div>
      )}
    </>
  );
}
