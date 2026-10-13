import type { ProjectBoard } from '@tracker/shared';
import { errorMessage, type TrackerQuery } from '../../api';
import { Button, Spinner } from '../../components';
import styles from './StatusManagerSheet.module.css';

export function BoardState({
  query,
  loading,
}: {
  query: TrackerQuery<ProjectBoard>;
  loading: string;
}) {
  if (!query.isError) {
    return (
      <div className={styles.loading}>
        <Spinner label={loading} />
      </div>
    );
  }
  return (
    <>
      <p role="alert" className={styles.error}>
        {errorMessage(query.error)}
      </p>
      <Button size="sm" className={styles.retry} onClick={() => void query.refetch()}>
        Try again
      </Button>
    </>
  );
}
