import { errorMessage, useCreateProject, useUpdateProject } from '../../api';
import type { SheetProps } from '../../app/sheets/types';
import { useToast } from '../../components';
import { useNavigation } from '../../navigation';
import {
  createdToast,
  createProjectInput,
  formValuesOf,
  hasName,
  NAME_REQUIRED,
  UPDATED_TOAST,
  updateProjectInput,
} from './projectForm';
import { ProjectFormSheet } from './ProjectFormSheet';
import { useProjectForm } from './useProjectForm';
import { useProjectSummary } from './useProjectSummary';

export function ProjectSheet({ projectKey, ...sheet }: SheetProps & { projectKey?: string }) {
  return projectKey === undefined ? (
    <NewProjectSheet {...sheet} />
  ) : (
    <EditProjectSheet {...sheet} projectKey={projectKey} />
  );
}

function NewProjectSheet({ open, onClose }: SheetProps) {
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

function EditProjectSheet({ open, onClose, projectKey }: SheetProps & { projectKey: string }) {
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
    />
  );
}
