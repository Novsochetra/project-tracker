import type { ChatChanges, ChatChangesAnswer } from '@tracker/shared';
import { Sheet, SheetActionButton, SheetCancelButton, SheetTextButton } from '../../../overlays';
import { ChangesOverview } from './ChangesOverview';
import { CommitForm } from './CommitForm';
import { CHANGES_LABEL, COMMIT_LABEL, PUSH_LABEL } from './copy';
import { PullRequestConfirm } from './PullRequestConfirm';
import { useChangesSheet, type ChangesSheetState, type ChangesStep } from './useChangesSheet';

export interface ChatChangesSheetProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
  chatTitle: string;
  answer: ChatChangesAnswer & { changes: ChatChanges };
}

const HEADS: Record<ChangesStep, { title: string; action: string | null }> = {
  view: { title: CHANGES_LABEL, action: null },
  commit: { title: COMMIT_LABEL, action: COMMIT_LABEL },
  pull_request: { title: 'Open pull request', action: PUSH_LABEL },
};

function Body({
  sheet,
  answer,
}: {
  sheet: ChangesSheetState;
  answer: ChatChangesSheetProps['answer'];
}) {
  const { changes } = answer;
  if (sheet.step === 'commit') {
    return (
      <CommitForm
        files={changes.files}
        values={sheet.values}
        onChange={sheet.setValues}
        error={sheet.error}
      />
    );
  }
  if (sheet.step === 'pull_request') {
    return (
      <PullRequestConfirm
        changes={changes}
        title={sheet.prTitle}
        onTitle={sheet.setPrTitle}
        error={sheet.error}
      />
    );
  }
  return (
    <ChangesOverview
      answer={answer}
      onCommit={sheet.startCommit}
      onPullRequest={sheet.startPullRequest}
    />
  );
}

export function ChatChangesSheet({
  open,
  onClose,
  chatId,
  chatTitle,
  answer,
}: ChatChangesSheetProps) {
  const sheet = useChangesSheet(chatId, chatTitle, answer.changes);
  const head = HEADS[sheet.step];
  const viewing = sheet.step === 'view';
  const close = () => {
    sheet.back();
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      label={head.title}
      title={head.title}
      size="wide"
      left={
        viewing ? (
          <SheetCancelButton>Close</SheetCancelButton>
        ) : (
          <SheetTextButton onClick={sheet.back}>Back</SheetTextButton>
        )
      }
      right={
        head.action && (
          <SheetActionButton type="submit" disabled={sheet.pending}>
            {head.action}
          </SheetActionButton>
        )
      }
      onSubmit={sheet.submit}
      dirty={!viewing}
    >
      <Body sheet={sheet} answer={answer} />
    </Sheet>
  );
}
