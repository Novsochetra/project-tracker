import { parseDiff, type ChatChangesAnswer, type ChatChanges } from '@tracker/shared';
import { FileCode, GitCommitHorizontal, GitPullRequestArrow } from 'lucide-react';
import { useMemo } from 'react';
import { Button, EmptyState } from '../../../components';
import { CUT_NOTE } from '../../changes/copy';
import { DiffView } from '../../changes/DiffView';
import { currentAction, isGoing } from './actionNote';
import { ActionNoteLine } from './ActionNoteLine';
import styles from './ChatChanges.module.css';
import { canOpenPullRequest } from './commitValues';
import {
  COMMIT_LABEL,
  fileCount,
  GH_NOTE,
  MAIN_NOTE,
  NO_CHANGES_TEXT,
  NO_CHANGES_TITLE,
  onBranch,
  OPEN_PR_LABEL,
} from './copy';

export interface ChangesOverviewProps {
  answer: ChatChangesAnswer & { changes: ChatChanges };
  onCommit: () => void;
  onPullRequest: () => void;
}

function prNote(changes: ChatChanges): string | null {
  if (!changes.ghReady) return GH_NOTE;
  return canOpenPullRequest(changes) ? null : MAIN_NOTE;
}

export function ChangesOverview({ answer, onCommit, onPullRequest }: ChangesOverviewProps) {
  const { changes } = answer;
  const action = currentAction(answer);
  const files = useMemo(() => parseDiff(changes.diff), [changes.diff]);
  const busy = isGoing(action);
  const note = prNote(changes);
  return (
    <div className={styles.body}>
      <p className={styles.summary}>
        <span>{onBranch(changes.branch)}</span>
        <span>{fileCount(changes.files.length)}</span>
      </p>
      <ActionNoteLine action={action} />
      <div className={styles.actions}>
        <Button
          variant="primary"
          icon={GitCommitHorizontal}
          disabled={busy || changes.files.length === 0}
          onClick={onCommit}
        >
          {COMMIT_LABEL}
        </Button>
        <Button
          icon={GitPullRequestArrow}
          disabled={busy || !canOpenPullRequest(changes)}
          onClick={onPullRequest}
        >
          {OPEN_PR_LABEL}
        </Button>
      </div>
      {note && <p className={styles.note}>{note}</p>}
      {changes.cut && <p className={styles.note}>{CUT_NOTE}</p>}
      {changes.files.length === 0 ? (
        <EmptyState icon={FileCode} title={NO_CHANGES_TITLE} text={NO_CHANGES_TEXT} bordered />
      ) : (
        <DiffView files={files} />
      )}
    </div>
  );
}
