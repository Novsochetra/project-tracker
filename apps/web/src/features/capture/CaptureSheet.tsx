import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { SheetProps } from '../../app/sheets/types';
import { clearDraft, markDraft } from '../../lib/drafts';
import { Sheet, SheetActionButton, SheetTextButton } from '../../overlays';
import { DropOverlay, useImageDrop } from '../attachments';
import { BLANK_CAPTURE, CAPTURE_DRAFT_ID, hasContent, type CaptureValues } from './captureForm';
import { CaptureDetails, CaptureText } from './CaptureFields';
import { CapturePhotoRow } from './CapturePhotoRow';
import styles from './CaptureSheet.module.css';
import { useCapturePhotos } from './useCapturePhotos';
import { useCaptureProject } from './useCaptureProject';
import { useCaptureSubmit } from './useCaptureSubmit';

// Sheets leave focus alone on phones so the keyboard doesn't jump up; capture wants it up at once,
// and since it opens from a tap iOS raises it. Runs after the sheet's own focus, so it wins.
function useFocusWhenOpen(ref: RefObject<HTMLInputElement | null>, open: boolean): void {
  useLayoutEffect(() => {
    if (open) ref.current?.focus({ preventScroll: true });
  }, [ref, open]);
}

function useCaptureDraft(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    markDraft(CAPTURE_DRAFT_ID);
    return () => clearDraft(CAPTURE_DRAFT_ID);
  }, [active]);
}

/** Quick capture: a title is enough; the project defaults to the last one used. */
export function CaptureSheet({ open, onClose }: SheetProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<CaptureValues>(BLANK_CAPTURE);
  const project = useCaptureProject();
  const photos = useCapturePhotos();
  const flow = useCaptureSubmit({
    values,
    project: project.current,
    photos: photos.items,
    uploading: photos.uploading,
    onDone: onClose,
  });
  const drop = useImageDrop(photos.add);
  useFocusWhenOpen(titleRef, open);
  useCaptureDraft(open && hasContent(values, photos.items.length));
  const update = (patch: Partial<CaptureValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    flow.clearError();
  };
  const removePhoto = (attachmentId: string) => {
    photos.remove(attachmentId);
    flow.clearError();
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="New ticket"
      title="New ticket"
      left={<SheetTextButton onClick={onClose}>Cancel</SheetTextButton>}
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
          onImages={photos.add}
        />
        <CapturePhotoRow photos={{ ...photos, remove: removePhoto }} />
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
