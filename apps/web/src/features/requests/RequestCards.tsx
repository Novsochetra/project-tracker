import type { RunRequest } from '@tracker/shared';
import { RequestCard } from './RequestCard';
import styles from './Requests.module.css';
import { useAnnounceRequests } from './useAnnounceRequests';

export interface RequestCardsProps {
  requests: RunRequest[];
  now: number;
}

export function RequestCards({ requests, now }: RequestCardsProps) {
  useAnnounceRequests(requests, now);
  if (requests.length === 0) return null;
  return (
    <div className={styles.cards}>
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} now={now} />
      ))}
    </div>
  );
}
