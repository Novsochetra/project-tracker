import type { DiffFile, TicketChanges as Changes, TicketDetail } from '@tracker/shared';
import clsx from 'clsx';
import { FileCode } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSetFileViewed } from '../../../api/hooks/changes';
import { EmptyState } from '../../../components';
import { useNow } from '../../../lib/useNow';
import { CUT_NOTE } from '../../changes/copy';
import type { LineAt } from '../../changes/diffLines';
import { DiffView } from '../../changes/DiffView';
import { ChangesHeader } from './ChangesHeader';
import { NO_CHANGES_TEXT, NO_CHANGES_TITLE } from './copy';
import { commentCount, lineId, lineThreads } from './lineComments';
import { LineThread } from './LineThread';
import styles from './TicketChanges.module.css';
import { useDraftedLines } from './useLineDrafts';

export interface TicketChangesProps {
  detail: TicketDetail;
  changes: Changes;
  files: readonly DiffFile[];
  className?: string | undefined;
}

// The latest ticket run's changes: viewed ticks, line comments and the person's verdict.
export function TicketChanges({ detail, changes, files, className }: TicketChangesProps) {
  const ticketKey = detail.ticket.key;
  const { runId } = changes;
  const threads = useMemo(() => lineThreads(detail.activity, runId), [detail.activity, runId]);
  const drafted = useDraftedLines(ticketKey);
  const [selected, setSelected] = useState<string | null>(null);
  const setViewed = useSetFileViewed();
  const now = useNow();

  const belowLine = (file: DiffFile, at: LineAt) => {
    const id = lineId(runId, file.path, at);
    return (
      <LineThread
        ticketKey={ticketKey}
        line={{ runId, path: file.path, ...at }}
        lineId={id}
        comments={threads.get(id) ?? []}
        boxOpen={selected === id || drafted.has(id)}
        focus={selected === id}
        now={now}
        onClose={() => setSelected(null)}
      />
    );
  };
  return (
    <div className={clsx(styles.panel, className)}>
      <div className={styles.inner}>
        <ChangesHeader
          detail={detail}
          changes={changes}
          files={files}
          commentCount={commentCount(threads)}
        />
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
            onLineSelect={(file, at) => {
              const id = lineId(runId, file.path, at);
              setSelected((now) => (now === id ? null : id));
            }}
            belowLine={belowLine}
          />
        )}
      </div>
    </div>
  );
}
