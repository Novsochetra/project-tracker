import { errorMessage, useUpdateProject } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { useToast } from '../../components';
import {
  formValuesOf,
  hasName,
  NAME_REQUIRED,
  UPDATED_TOAST,
  updateProjectInput,
} from './projectForm';
import { ProjectFormSheet } from './ProjectFormSheet';
import { ProjectSwitchField } from './ProjectSwitchField';
import { useProjectForm } from './useProjectForm';
import { useProjectSummary } from './useProjectSummary';

export function EditProjectSheet({
  open,
  onClose,
  projectKey,
}: SheetProps & { projectKey: string }) {
  const project = useProjectSummary(projectKey);
  const form = useProjectForm(project && formValuesOf(project));
  const update = useUpdateProject();
  const toast = useToast();
  const submit = () => {
    if (!hasName(form.values)) {
      form.setError(NAME_REQUIRED);
      return;
    }
    if (update.isPending) return;
    const input = updateProjectInput(form.values);
    update.mutate(
      { projectKey: project?.key ?? projectKey, input },
      {
        onSuccess: () => {
          onClose();
          toast.show(UPDATED_TOAST);
        },
        onError: (error) => form.setError(errorMessage(error)),
      },
    );
  };
  return (
    <ProjectFormSheet
      mode="edit"
      open={open}
      onClose={onClose}
      form={form}
      pending={update.isPending}
      onSubmit={submit}
    >
      <ProjectSwitchField form={form} field="hideName" />
      <ProjectSwitchField form={form} field="autoReview" />
    </ProjectFormSheet>
  );
}
