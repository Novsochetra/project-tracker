import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { SheetProps } from '../../app/sheets/types';
import { useDraftMark } from '../../lib/useDraftMark';
import { Sheet, SheetActionButton, SheetCancelButton } from '../../overlays';
import { AttachmentPicker, DropOverlay, useFileDrop } from '../attachments';
import { CAPTURE_DRAFT_ID, hasContent, type CaptureValues } from './captureForm';
import { CaptureDetails, CaptureText } from './CaptureFields';
import styles from './CaptureSheet.module.css';
import { forgetKeptCapture, keptCapture, useCaptureId, useKeepCapture } from './keptCapture';
import { useCaptureFiles } from './useCaptureFiles';
import { useCaptureProject } from './useCaptureProject';
import { useCaptureSubmit } from './useCaptureSubmit';

// Sheets leave focus alone on phones so the keyboard doesn't jump up; capture wants it up at once,
// and since it opens from a tap iOS raises it. Runs after the sheet's own focus, so it wins.
function useFocusWhenOpen(ref: RefObject<HTMLTextAreaElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [ref, open]);
}

export function CaptureSheet({ open, onClose }: SheetProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [kept] = useState(keptCapture);
  const [values, setValues] = useState<CaptureValues>(kept.values);
  const project = useCaptureProject(kept.projectKey);
  const files = useCaptureFiles();
  const captureId = useCaptureId(kept.clientId);
  const finish = () => {
    forgetKeptCapture();
    onClose();
  };
  const flow = useCaptureSubmit({
    values,
    project: project.current,
    attachments: files.items,
    uploading: files.uploading.length,
    captureId: captureId.take,
    onDone: finish,
  });
  const drop = useFileDrop(files.add);
  // A file still uploading counts too: the person chose it.
  const fileCount = files.items.length + files.uploading.length;
  const dirty = hasContent(values, fileCount);
  useFocusWhenOpen(titleRef, open);
  useKeepCapture({ values, projectKey: project.chosenKey, clientId: captureId.clientId }, open);
  // The text is kept for the next opening, but files are not, so a reload would lose them.
  useDraftMark(CAPTURE_DRAFT_ID, open && fileCount > 0);
  const update = (patch: Partial<CaptureValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    flow.clearError();
  };
  const removeFile = (attachmentId: string) => {
    files.remove(attachmentId);
    flow.clearError();
  };
  // Closed without creating: the uploads have no ticket to wait for.
  const close = () => {
    files.discard(files.items);
    finish();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      label="New ticket"
      title="New ticket"
      dirty={dirty}
      left={<SheetCancelButton />}
      right={
        <SheetActionButton type="submit" disabled={!flow.canSubmit}>
          Create
        </SheetActionButton>
      }
      initialFocusRef={titleRef}
      onSubmit={(event) => {
        event.preventDefault();
        flow.submit();
      }}
    >
      <div className={styles.body} {...drop.handlers}>
        <CaptureText
          values={values}
          titleRef={titleRef}
          onChange={update}
          onEnter={flow.submit}
          onFiles={files.add}
        />
        <AttachmentPicker
          size="sm"
          attachments={files.items}
          uploads={files}
          inputLabel="Add files to ticket"
          onRemove={removeFile}
          className={styles.attachments}
        />
        <CaptureDetails
          values={values}
          project={project}
          error={flow.error}
          onChange={update}
          onProject={(projectKey) => {
            project.choose(projectKey);
            flow.clearError();
          }}
        />
        {drop.active && <DropOverlay />}
      </div>
    </Sheet>
  );
}
