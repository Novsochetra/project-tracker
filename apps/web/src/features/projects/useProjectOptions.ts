import { errorMessage, useDeleteProject } from '../../api';
import { useSheets } from '../../app/sheets/context';
import { useToast } from '../../components';
import { useNavigation, type Navigation } from '../../navigation';
import { deletedToast } from './projectOptions';
import { useProjectSummary } from './useProjectSummary';

export interface ProjectOptions {
  name: string;
  ticketCount: number;
  pending: boolean;
  error: string | null;
  edit: () => void;
  manageStatuses: () => void;
  connect: () => void;
  deleteProject: (onDeleted: () => void) => void;
  resetDelete: () => void;
}

function leaveProject({ route, back, replace }: Navigation): void {
  if (route.name === 'project') back();
  else replace({ name: 'projects' });
}

export function useProjectOptions(projectKey: string): ProjectOptions {
  const project = useProjectSummary(projectKey);
  const sheets = useSheets();
  const toast = useToast();
  const navigation = useNavigation();
  const remove = useDeleteProject();
  const key = project?.key ?? projectKey;
  const name = project?.name ?? key;
  const deleteProject = (onDeleted: () => void) => {
    if (remove.isPending) return;
    remove.mutate(
      { projectKey: key },
      {
        onSuccess: () => {
          onDeleted();
          leaveProject(navigation);
          toast.show(deletedToast(name));
        },
      },
    );
  };
  return {
    name,
    ticketCount: project?.totalCount ?? 0,
    pending: remove.isPending,
    error: remove.error ? errorMessage(remove.error) : null,
    edit: () => sheets.open({ type: 'editProject', projectKey: key }),
    manageStatuses: () => sheets.open({ type: 'statuses', projectKey: key }),
    connect: () => sheets.open({ type: 'connect' }),
    deleteProject,
    resetDelete: remove.reset,
  };
}
