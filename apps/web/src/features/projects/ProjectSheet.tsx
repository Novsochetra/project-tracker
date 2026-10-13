import { errorMessage, useCreateProject } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { useToast } from '../../components';
import { useNavigation } from '../../navigation';
import { createdToast, createProjectInput, hasName, NAME_REQUIRED } from './projectForm';
import { ProjectFormSheet } from './ProjectFormSheet';
import { useProjectForm } from './useProjectForm';

// Edit project loads when opened (EditProjectSheet.tsx); New project is on the first screen.
export function ProjectSheet({ open, onClose }: SheetProps) {
  const form = useProjectForm(undefined);
  const create = useCreateProject();
  const { push } = useNavigation();
  const toast = useToast();
  const submit = () => {
    if (!hasName(form.values)) {
      form.setError(NAME_REQUIRED);
      return;
    }
    if (create.isPending) return;
    create.mutate(createProjectInput(form.values), {
      onSuccess: ({ project }) => {
        onClose();
        push({ name: 'project', key: project.key });
        toast.show(createdToast(project.name));
      },
      onError: (error) => form.setError(errorMessage(error)),
    });
  };
  return (
    <ProjectFormSheet
      mode="new"
      open={open}
      onClose={onClose}
      form={form}
      pending={create.isPending}
      onSubmit={submit}
    />
  );
}
