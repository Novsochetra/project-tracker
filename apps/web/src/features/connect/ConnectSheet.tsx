import type { ServerMeta } from '@tracker/shared';
import { errorMessage, type TrackerQuery } from '../../api';
import { useMeta } from '../../api/hooks/meta';
import type { SheetProps } from '../../app/sheets/types';
import { Button, Spinner } from '../../components';
import { useOptionalNavigation } from '../../navigation/useNavigation';
import { Sheet, SheetTextButton } from '../../overlays';
import { Columns } from './Columns';
import { routeProjectKey } from './connectCommand';
import styles from './ConnectSheet.module.css';
import { ConnectSteps } from './ConnectSteps';
import { Setup } from './Setup';

export function ConnectSheet({ open, onClose }: SheetProps) {
  const meta = useMeta();
  const projectKey = routeProjectKey(useOptionalNavigation()?.route);
  const intro = (
    <>
      <p className={styles.help}>
        Claude Code agents can pick up your tickets, do the work and hand it back for review.
      </p>
      <ConnectSteps />
    </>
  );
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Connect Claude Code"
      title="Connect Claude Code"
      size="wide"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      {meta.data ? (
        <Setup meta={meta.data} projectKey={projectKey} intro={intro} />
      ) : (
        <Columns aside={intro} main={<MetaState query={meta} />} />
      )}
    </Sheet>
  );
}

function MetaState({ query }: { query: TrackerQuery<ServerMeta> }) {
  if (!query.isError) {
    return (
      <div className={styles.loading}>
        <Spinner label="Loading the setup commands" />
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
