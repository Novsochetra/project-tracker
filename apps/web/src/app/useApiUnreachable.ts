import { useProjects } from '../api';
import { isApiUnreachable } from './offline';
import { useOnline } from './useOnline';

export function useApiUnreachable(): boolean {
  const online = useOnline();
  const { error } = useProjects();
  return isApiUnreachable(online, error);
}
