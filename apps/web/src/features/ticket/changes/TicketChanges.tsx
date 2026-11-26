import type { DiffFile, TicketChanges as Changes, TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import { FileCode } from 'lucide-react';
import { useSetFileViewed } from '../../../api/hooks/changes';
import { EmptyState } from '../../../components';
import { CUT_NOTE } from '../../changes/copy';
import { DiffView } from '../../changes/DiffView';
import { ChangesHeader } from './ChangesHeader';
import { NO_CHANGES_TEXT, NO_CHANGES_TITLE } from './copy';
import styles from './TicketChanges.module.css';

export interface TicketChangesProps {
  detail: TicketDetail;
  changes: Changes;
  files: readonly DiffFile[];
  className?: string | undefined;
}

export function TicketChanges({ detail, changes, files, className }: TicketChangesProps) {
  const ticketKey = detail.ticket.key;
  const setViewed = useSetFileViewed();

  return (
    <div className={clsx(styles.panel, className)}>
      <div className={styles.inner}>
        <ChangesHeader detail={detail} changes={changes} files={files} />
        {changes.cut && <p className={styles.cut}>{CUT_NOTE}</p>}
        {files.length === 0 ? (
          <EmptyState icon={FileCode} title={NO_CHANGES_TITLE} text={NO_CHANGES_TEXT} bordered />
        ) : (
          <DiffView
            files={files}
            viewed={changes.viewed}
            onViewedChange={(file, viewed) =>
              setViewed.mutate({
                ticketKey,
                input: { path: file.path, digest: file.digest, viewed },
              })
            }
          />
        )}
      </div>
    </div>
  );
}
