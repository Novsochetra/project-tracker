import type { Project, Status } from '@tracker/shared';
import { useRef, useState } from 'react';
import { useBoard } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { Sheet, SheetActionButton, SheetCancelButton } from '../../overlays';
import { NewTicketFields } from './NewTicketFields';
import styles from './NewTicketSheet.module.css';
import {
  blankForm,
  chosenStatusId,
  defaultStatusId,
  hasChanges,
  TITLE_REQUIRED,
  toCreateInput,
  type NewTicketForm,
} from './newTicketForm';
import { useCreateTicketFlow } from './useCreateTicketFlow';

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
  const titleRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState('');
  // The host keeps this sheet mounted between openings: each opening starts a blank form.
  const [openedAs, setOpenedAs] = useState(open);
  if (open !== openedAs) {
    setOpenedAs(open);
    if (open) {
      setForm(blankForm());
      setError('');
    }
  }
  const flow = useCreateTicketFlow({ projectKey, statuses, onCreated: onClose, onError: setError });
  const status = chosenStatusId(form, statuses, statusId);
  const update = (patch: Partial<NewTicketForm>) => {
    setForm((current) => ({ ...current, ...patch }));
    setError('');
  };
  const submit = () => {
    if (!form.title.trim()) setError(TITLE_REQUIRED);
    else flow.submit(toCreateInput(form, status));
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="New ticket"
      title="New ticket"
      subtitle={board && <ProjectSubtitle project={board.project} />}
      left={<SheetCancelButton />}
      right={
        <SheetActionButton type="submit" disabled={!form.title.trim() || flow.pending}>
          Create
        </SheetActionButton>
      }
      initialFocusRef={titleRef}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      dirty={hasChanges(form, defaultStatusId(statuses, statusId))}
    >
      <NewTicketFields
        form={form}
        statuses={statuses}
        statusId={status}
        error={error}
        titleRef={titleRef}
        onChange={update}
        onEnter={submit}
      />
    </Sheet>
  );
}
