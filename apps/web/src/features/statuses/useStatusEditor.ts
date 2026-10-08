import type { Status } from '@tracker/shared';
import { useState } from 'react';
import { useCreateStatus, useUpdateStatus } from '../../api';
import {
  createInput,
  draftOf,
  nameIssue,
  newDraft,
  updateInput,
  type NameIssue,
  type StatusDraft,
} from './statusForm';

export interface StatusEditorTarget {
  projectKey: string;
  status: Status | null;
  statuses: readonly Status[];
  onDone: (focusId?: string) => void;
  onDeleted: (statusId: string) => void;
}

export interface StatusEditorState {
  draft: StatusDraft;
  change: (patch: Partial<StatusDraft>) => void;
  issue: NameIssue | null;
  pending: boolean;
  error: Error | null;
  save: () => void;
}

export function useStatusEditor({
  projectKey,
  status,
  statuses,
  onDone,
}: StatusEditorTarget): StatusEditorState {
  const [draft, setDraft] = useState(() => (status ? draftOf(status) : newDraft(statuses)));
  const create = useCreateStatus();
  const update = useUpdateStatus();
  const issue = nameIssue(draft.name, statuses, status?.id);
  const pending = create.isPending || update.isPending;

  const save = () => {
    if (issue || pending) return;
    if (!status) {
      create.mutate(
        { projectKey, input: createInput(draft) },
        { onSuccess: (created) => onDone(created.id) },
      );
      return;
    }
    const input = updateInput(status, draft);
    if (Object.keys(input).length === 0) {
      onDone(status.id);
      return;
    }
    update.mutate(
      { projectKey, statusId: status.id, input },
      { onSuccess: () => onDone(status.id) },
    );
  };

  return {
    draft,
    change: (patch) => setDraft((current) => ({ ...current, ...patch })),
    issue,
    pending,
    error: create.error ?? update.error,
    save,
  };
}
