import { Suspense } from 'react';
import { CaptureSheet } from '../../features/capture/CaptureSheet';
import { ProjectSheet } from '../../features/projects/ProjectSheet';
import { ErrorBoundary } from '../../lib/ErrorBoundary';
import {
  AccountSheet,
  ConnectSheet,
  EditProjectSheet,
  LabelManagerSheet,
  NewTicketSheet,
  PromptSheet,
  ReportSheet,
  RunStepsSheet,
  StatusManagerSheet,
} from '../lazyParts';
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
      {/* A sheet whose code is still on its way slides in once it arrives. */}
      <Suspense fallback={null}>
        <RequestedSheet request={request} open={open} onClose={onClose} />
      </Suspense>
    </ErrorBoundary>
  );
}

function RequestedSheet({ request, open, onClose }: SheetProps & { request: SheetRequest }) {
  const sheet = { open, onClose };
  switch (request.type) {
    case 'newProject':
      return <ProjectSheet {...sheet} />;
    case 'editProject':
      return <EditProjectSheet {...sheet} projectKey={request.projectKey} />;
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
    case 'labels':
      return <LabelManagerSheet {...sheet} projectKey={request.projectKey} />;
    case 'runSteps':
      return <RunStepsSheet {...sheet} runId={request.runId} ticketKey={request.ticketKey} />;
    case 'connect':
      return <ConnectSheet {...sheet} />;
    case 'account':
      return <AccountSheet {...sheet} />;
  }
}
