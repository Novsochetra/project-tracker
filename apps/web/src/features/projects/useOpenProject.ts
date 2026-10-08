import { usePrefetchBoard } from '../../api';
import { useNavigation } from '../../navigation';

// On a first visit the Project screen's code is still on its way when a project is pressed, and the
// screen reads its board only once it renders: reading it now does both at once.
export function useOpenProject(): (projectKey: string) => void {
  const { push } = useNavigation();
  const prefetchBoard = usePrefetchBoard();
  return (projectKey) => {
    prefetchBoard(projectKey);
    push({ name: 'project', key: projectKey });
  };
}
