import type { PromptResult, RunRole } from '@tracker/shared';
import clsx from 'clsx';
import { Share } from 'lucide-react';
import { useRef, type ReactNode, type RefObject } from 'react';
import { errorMessage, type TrackerQuery } from '../../api';
import { Button, IconButton, Spinner, useToast } from '../../components';
import { copyText } from '../../lib/clipboard';
import { canShare, sharePrompt } from '../../lib/share';
import { Sheet, SheetTextButton } from '../../overlays';
import { PromptFooter } from './PromptFooter';
import styles from './PromptSheet.module.css';
import { runPromptTooLong } from './runs';
import {
  COPY_BLOCKED,
  copyPromptFlow,
  promptHelp,
  sharePromptFlow,
  sheetTitle,
} from './sendPrompt';
import { useCopyState } from './useCopyState';
import type { PromptDraft } from './usePromptDraft';
import type { RunOffer } from './useRunOffer';

export interface PromptViewProps {
  open: boolean;
  onClose: () => void;
  subtitle: string;
  query: TrackerQuery<PromptResult>;
  draft: PromptDraft;
  onSent: () => void;
  role?: RunRole;
  run?: RunOffer;
  boxNote?: ReactNode;
  sendSwitch?: ReactNode;
  sendError?: Error | null;
}

export function PromptView({
  open,
  onClose,
  subtitle,
  query,
  draft,
  onSent,
  role = 'work',
  run,
  ...rest
}: PromptViewProps) {
  const toast = useToast();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [copyOutcome, reportCopy] = useCopyState();
  const hasPrompt = Boolean(draft.result?.text);
  const offersRun = run?.footer.kind === 'run';
  const tooLong = offersRun ? runPromptTooLong(draft.text) : null;
  const copy = async () =>
    reportCopy(
      await copyPromptFlow({
        copy: () => copyText(draft.text, fieldRef.current),
        notify: toast.show,
        markSent: onSent,
      }),
    );
  const share = () =>
    void sharePromptFlow({ share: () => sharePrompt(draft.text), markSent: onSent });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={sheetTitle(role)}
      size="prompt"
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
      title={sheetTitle(role)}
      subtitle={subtitle || undefined}
      right={
        hasPrompt && canShare() ? (
          <IconButton
            icon={Share}
            aria-label="Share prompt"
            tone="ink"
            className={styles.share}
            onClick={share}
          />
        ) : undefined
      }
      footer={
        hasPrompt ? (
          <PromptFooter
            copied={copyOutcome === 'copied'}
            disabled={!draft.text.trim()}
            onCopy={() => void copy()}
            run={run}
            runBlocked={tooLong !== null}
            onRun={() => run?.start(draft.text, role)}
          />
        ) : undefined
      }
    >
      <div className={styles.body}>
        <PromptBody
          query={query}
          draft={draft}
          fieldRef={fieldRef}
          copyFailed={copyOutcome === 'failed'}
          offersRun={offersRun}
          tooLong={tooLong}
          role={role}
          {...rest}
        />
      </div>
    </Sheet>
  );
}

interface PromptBodyProps {
  query: TrackerQuery<PromptResult>;
  draft: PromptDraft;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  copyFailed: boolean;
  offersRun: boolean;
  tooLong: string | null;
  role: RunRole;
  boxNote?: ReactNode;
  sendSwitch?: ReactNode;
  sendError?: Error | null;
}

function PromptBody({
  query,
  draft,
  fieldRef,
  copyFailed,
  offersRun,
  tooLong,
  role,
  boxNote,
  sendSwitch,
  sendError,
}: PromptBodyProps) {
  if (!draft.result) {
    if (query.isError)
      return <LoadError error={query.error} onRetry={() => void query.refetch()} />;
    return (
      <div className={styles.loading}>
        <Spinner label="Loading the prompt" />
      </div>
    );
  }
  const hasPrompt = draft.result.text.length > 0;
  return (
    <>
      <p className={styles.help}>{promptHelp(hasPrompt, offersRun, role)}</p>
      {hasPrompt && (
        <textarea
          ref={fieldRef}
          className={styles.prompt}
          aria-label="Prompt for Claude Code"
          rows={12}
          spellCheck={false}
          value={draft.text}
          onChange={(event) => draft.setText(event.target.value)}
        />
      )}
      {hasPrompt && boxNote}
      {tooLong && <Alert>{tooLong}</Alert>}
      {sendSwitch}
      {copyFailed && <Alert>{COPY_BLOCKED}</Alert>}
      {sendError && <Alert>{errorMessage(sendError)}</Alert>}
    </>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className={clsx(styles.error, 'fade-in')}>
      {children}
    </p>
  );
}

function LoadError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <>
      <Alert>{errorMessage(error)}</Alert>
      <Button size="sm" className={styles.retry} onClick={onRetry}>
        Try again
      </Button>
    </>
  );
}
