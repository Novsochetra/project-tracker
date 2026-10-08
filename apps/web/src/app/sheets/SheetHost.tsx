import { CaptureSheet } from '../../features/capture/CaptureSheet';
import { PromptSheet } from '../../features/claude/PromptSheet';
import { ReportSheet } from '../../features/claude/ReportSheet';
import { ConnectSheet } from '../../features/connect/ConnectSheet';
import { NewTicketSheet } from '../../features/project/NewTicketSheet';
import { ProjectSheet } from '../../features/projects/ProjectSheet';
import { StatusManagerSheet } from '../../features/statuses/StatusManagerSheet';
import { ErrorBoundary } from '../../lib/ErrorBoundary';
import { SheetError } from './SheetError';
import type { SheetProps, SheetRequest } from './types';

interface Props extends SheetProps {
  request: SheetRequest | null;
}

// Each request gets a host of its own, so a sheet that failed is tried afresh when opened again.
export function SheetHost({ request, open, onClose }: Props) {
  if (!request) return null;
  return (
    <ErrorBoundary
      name={`Sheet ${request.type}`}
      fallback={<SheetError open={open} onClose={onClose} />}
    >
      <RequestedSheet request={request} open={open} onClose={onClose} />
    </ErrorBoundary>
  );
}

function RequestedSheet({ request, open, onClose }: SheetProps & { request: SheetRequest }) {
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
    case 'capture':
      return <CaptureSheet {...sheet} />;
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
