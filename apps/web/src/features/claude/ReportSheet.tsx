import clsx from 'clsx';
import { ClipboardCheck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { errorMessage, useApplyReport, useProject, useReportPreview } from '../../api';
import { flashRows } from '../../app/flash';
import type { ReportScope, SheetProps } from '../../app/sheets/types';
import { Button, useToast } from '../../components';
import { readClipboardText } from '../../lib/clipboard';
import { Sheet, SheetActionButton, SheetCancelButton } from '../../overlays';
import { ChangesPreview } from './ChangesPreview';
import {
  appliedMessage,
  isNoMatch,
  noMatchMessage,
  reportHelp,
  reportPlaceholder,
  reportSubtitle,
  reportView,
} from './pasteReport';
import styles from './ReportSheet.module.css';
import { useHeldWhileClosed } from './useHeldWhileClosed';

type ReportSheetProps = SheetProps & { scope: ReportScope };

function useReportForm({ open, onClose, scope }: ReportSheetProps) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ticketKey = scope.kind === 'ticket' ? scope.ticketKey : undefined;
  const preview = useReportPreview(text, ticketKey);
  const apply = useApplyReport();
  const previewError = preview.isError ? errorMessage(preview.error) : null;
  const live = useMemo(
    () =>
      reportView({ text, error, preview: preview.data, previewError, applying: apply.isPending }),
    [text, error, preview.data, previewError, apply.isPending],
  );
  // Applying moves tickets, so the preview refetches while the sheet animates out.
  const view = useHeldWhileClosed(open, live);

  const changeText = (next: string) => {
    setText(next);
    setError(null);
  };
  const paste = async () => {
    const result = await readClipboardText();
    if (result.ok) changeText(result.text);
    else setError(result.message);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!view.canApply) return;
    apply.mutate(
      { text, ticketKey },
      {
        onSuccess: ({ updatedTicketKeys }) => {
          onClose();
          flashRows(updatedTicketKeys);
          toast.show(appliedMessage(updatedTicketKeys.length));
        },
        onError: (failure) =>
          setError(isNoMatch(failure) ? noMatchMessage(scope.projectKey) : errorMessage(failure)),
      },
    );
  };
  return { ...view, changeText, paste, submit, dirty: text.trim() !== '' };
}

export function ReportSheet(props: ReportSheetProps) {
  const { open, onClose, scope } = props;
  const form = useReportForm(props);
  const project = useProject(scope.projectKey);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Paste Claude Code report"
      size="report"
      onSubmit={form.submit}
      dirty={form.dirty}
      left={<SheetCancelButton />}
      title="Paste report"
      subtitle={reportSubtitle(scope, project.data?.project.name) || undefined}
      right={
        <SheetActionButton type="submit" disabled={!form.canApply}>
          Apply
        </SheetActionButton>
      }
    >
      <div className={styles.body}>
        <p className={styles.help}>{reportHelp(scope)}</p>
        <Button icon={ClipboardCheck} className={styles.paste} onClick={() => void form.paste()}>
          Paste from clipboard
        </Button>
        <textarea
          className={styles.report}
          aria-label="Report"
          rows={8}
          spellCheck={false}
          placeholder={reportPlaceholder(scope)}
          value={form.text}
          onChange={(event) => form.changeText(event.target.value)}
        />
        {form.items.length > 0 && <ChangesPreview items={form.items} />}
        {form.error && (
          <p role="alert" className={clsx(styles.error, 'fade-in')}>
            {form.error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
