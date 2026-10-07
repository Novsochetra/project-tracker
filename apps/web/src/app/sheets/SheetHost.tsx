import { PromptSheet } from '../../features/claude/PromptSheet';
import { ReportSheet } from '../../features/claude/ReportSheet';
import { ConnectSheet } from '../../features/connect/ConnectSheet';
import { NewTicketSheet } from '../../features/project/NewTicketSheet';
import { ProjectSheet } from '../../features/projects/ProjectSheet';
import { StatusManagerSheet } from '../../features/statuses/StatusManagerSheet';
import type { SheetProps, SheetRequest } from './types';

interface Props extends SheetProps {
  request: SheetRequest | null;
}

export function SheetHost({ request, open, onClose }: Props) {
  if (!request) return null;
  const sheet = { open, onClose };
  switch (request.type) {
    case 'newProject':
      return <ProjectSheet {...sheet} />;
    case 'editProject':
      return <ProjectSheet {...sheet} projectKey={request.projectKey} />;
    case 'newTicket':
      return (
        <NewTicketSheet {...sheet} projectKey={request.projectKey} statusId={request.statusId} />
      );
    case 'prompt':
      return <PromptSheet {...sheet} scope={request.scope} />;
    case 'report':
      return <ReportSheet {...sheet} scope={request.scope} />;
    case 'statuses':
      return <StatusManagerSheet {...sheet} projectKey={request.projectKey} />;
    case 'connect':
      return <ConnectSheet {...sheet} />;
  }
}
