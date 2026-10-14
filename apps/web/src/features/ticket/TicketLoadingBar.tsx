import { projectDisplayName } from '@tracker/shared';
import { useProject } from '../../api';
import { NavBar, NavBarSpacer } from '../../navigation';

export interface TicketLoadingBarProps {
  projectKey: string;
  num: number;
}

// Shared by the screen while its ticket is on its way and the app's loading state while the
// screen's code is (PT-108), so the bar stays put when either arrives.
export function TicketLoadingBar({ projectKey, num }: TicketLoadingBarProps) {
  const project = useProject(projectKey).data?.project;
  const projectName = project ? projectDisplayName(project) : projectKey;
  const ticketKey = `${projectKey}-${num}`.toUpperCase();
  return <NavBar title={ticketKey} mono backLabel={projectName} right={<NavBarSpacer />} />;
}
