import type { Label } from '@tracker/shared';
import { errorMessage } from '../../api';
import { useCreateLabel } from '../../api/hooks/labels';
import { useToast } from '../../components';
import { newLabelInput } from './pickerLogic';

export interface NewLabel {
  create: (name: string) => Promise<Label | null>;
  creating: boolean;
}

export function useNewLabel(projectKey: string, labels: readonly Label[]): NewLabel {
  const { mutateAsync, isPending } = useCreateLabel();
  const { show } = useToast();
  const create = (name: string) =>
    mutateAsync({ projectKey, input: newLabelInput(labels, name) }).catch((error: unknown) => {
      show(errorMessage(error), { kind: 'error' });
      return null;
    });
  return { create, creating: isPending };
}
