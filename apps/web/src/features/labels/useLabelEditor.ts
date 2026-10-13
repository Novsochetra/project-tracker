import type { Label } from '@tracker/shared';
import { useState } from 'react';
import { useCreateLabel, useUpdateLabel } from '../../api/hooks/labels';
import {
  createInput,
  draftChanged,
  draftOf,
  nameIssue,
  newDraft,
  updateInput,
  type LabelDraft,
  type NameIssue,
} from './labelForm';

export interface LabelEditorTarget {
  projectKey: string;
  label: Label | null;
  labels: readonly Label[];
  onDone: (focusId?: string) => void;
  onDeleted: (labelId: string) => void;
}

export interface LabelEditorState {
  draft: LabelDraft;
  dirty: boolean;
  change: (patch: Partial<LabelDraft>) => void;
  issue: NameIssue | null;
  pending: boolean;
  error: Error | null;
  save: () => void;
}

export function useLabelEditor({
  projectKey,
  label,
  labels,
  onDone,
}: LabelEditorTarget): LabelEditorState {
  const [initial] = useState(() => (label ? draftOf(label) : newDraft(labels)));
  const [draft, setDraft] = useState(initial);
  const create = useCreateLabel();
  const update = useUpdateLabel();
  const issue = nameIssue(draft.name, labels, label?.id);
  const pending = create.isPending || update.isPending;

  const save = () => {
    if (issue || pending) return;
    if (!label) {
      create.mutate(
        { projectKey, input: createInput(draft) },
        { onSuccess: (created) => onDone(created.id) },
      );
      return;
    }
    const input = updateInput(label, draft);
    if (Object.keys(input).length === 0) {
      onDone(label.id);
      return;
    }
    update.mutate({ projectKey, labelId: label.id, input }, { onSuccess: () => onDone(label.id) });
  };

  return {
    draft,
    dirty: draftChanged(initial, draft),
    change: (patch) => setDraft((current) => ({ ...current, ...patch })),
    issue,
    pending,
    error: create.error ?? update.error,
    save,
  };
}
