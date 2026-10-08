import type { Project, Status } from '@tracker/shared';
import { useRef, useState } from 'react';
import { useBoard } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { Sheet, SheetActionButton, SheetCancelButton } from '../../overlays';
import { AttachmentPicker, DropOverlay, useFileDrop } from '../attachments';
import { forgetKeptForm, keptForm, useKeepForm } from './keptForm';
import { NewTicketFields } from './NewTicketFields';
import styles from './NewTicketSheet.module.css';
import {
  chosenStatusId,
  defaultStatusId,
  hasChanges,
  TITLE_REQUIRED,
  toCreateInput,
  withoutGoneStatus,
  type NewTicketForm,
} from './newTicketForm';
import { useCreateTicketFlow } from './useCreateTicketFlow';
import { useNewTicketFiles } from './useNewTicketFiles';

export interface NewTicketSheetProps extends SheetProps {
  projectKey: string;
  statusId?: string | undefined;
}

const NO_STATUSES: readonly Status[] = [];

function ProjectSubtitle({ project }: { project: Project }) {
  return (
    <>
      <span className={styles.square} style={{ background: project.color }} aria-hidden="true" />
      <span className={styles.projectName}>{project.name}</span>
    </>
  );
}

export function NewTicketSheet({ open, onClose, projectKey, statusId }: NewTicketSheetProps) {
  const board = useBoard(projectKey).data;
  const statuses = board?.statuses ?? NO_STATUSES;
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [form, setForm] = useState(() => keptForm(projectKey));
  const [error, setError] = useState('');
  const known = board ? withoutGoneStatus(form, board.statuses) : form;
  if (known !== form) setForm(known);
  const files = useNewTicketFiles(setForm, projectKey, open);
  const drop = useFileDrop(files.add);
  const uploading = files.uploading.length > 0;
  const changed = hasChanges(form, defaultStatusId(statuses, statusId));
  useKeepForm({ projectKey, form, open, changed });
  const created = () => {
    forgetKeptForm(projectKey);
    onClose();
  };
  // Closed without creating: the uploads have no ticket to wait for.
  const close = () => {
    files.discard(form.attachments);
    created();
  };
  const flow = useCreateTicketFlow({ projectKey, statuses, onCreated: created, onError: setError });
  const status = chosenStatusId(form, statuses, statusId);
  const update = (patch: Partial<NewTicketForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  };
  // Create waits for the files on their way, as its disabled button shows.
  const submit = () => {
    if (!form.title.trim()) setError(TITLE_REQUIRED);
    else if (!uploading) flow.submit(toCreateInput(form, status));
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      label="New ticket"
      title="New ticket"
      subtitle={board && <ProjectSubtitle project={board.project} />}
      left={<SheetCancelButton />}
      right={
        <SheetActionButton type="submit" disabled={!form.title.trim() || flow.pending || uploading}>
          Create
        </SheetActionButton>
      }
      initialFocusRef={titleRef}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      dirty={changed || uploading}
    >
      <div className={styles.body} {...drop.handlers}>
        <NewTicketFields
          form={form}
          statuses={statuses}
          statusId={status}
          error={error}
          titleRef={titleRef}
          onChange={update}
          onEnter={submit}
          onFiles={files.add}
          attachments={
            <AttachmentPicker
              size="sm"
              attachments={form.attachments}
              uploads={files}
              inputLabel="Add files to ticket"
              onRemove={files.remove}
              className={styles.attachments}
            />
          }
        />
        {drop.active && <DropOverlay />}
      </div>
    </Sheet>
  );
}
