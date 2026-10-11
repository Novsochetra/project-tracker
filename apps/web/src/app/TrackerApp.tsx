import type { QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import { Suspense } from 'react';
import { BrowserRouter, useLocation } from 'react-router';
import { ApiProvider, useSession } from '../api';
import { ToastProvider } from '../components';
import { useFileDropGuard } from '../features/attachments';
import { useTicketDrafts } from '../features/ticket/drafts/useTicketDrafts';
import { NavigationProvider } from '../navigation';
import { InviteScreen, ResetScreen, screensOnTheirWay } from './lazyParts';
import { LoginScreen } from './LoginScreen';
import { gateFor, linkPageOf } from './sessionGate';
import { SheetsProvider } from './sheets/SheetsProvider';
import { Shell } from './Shell';

export interface TrackerAppProps {
  client?: TrackerClient;
  queryClient?: QueryClient;
}

export function TrackerApp({ client, queryClient }: TrackerAppProps) {
  useFileDropGuard();
  return (
    <ApiProvider client={client} queryClient={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <NavigationProvider prepare={screensOnTheirWay}>
            <SheetsProvider>
              <SessionGate />
            </SheetsProvider>
          </NavigationProvider>
        </BrowserRouter>
      </ToastProvider>
    </ApiProvider>
  );
}

function SessionGate() {
  const { data, fetchStatus } = useSession();
  const gate = gateFor({ data, fetchStatus }, linkPageOf(useLocation().pathname));
  useTicketDrafts(gate === 'app');
  switch (gate) {
    case 'loading':
      return null;
    case 'login':
      return <LoginScreen setupRequired={data?.setupRequired === true} />;
    case 'invite':
      return (
        <Suspense fallback={null}>
          <InviteScreen />
        </Suspense>
      );
    case 'reset':
      return (
        <Suspense fallback={null}>
          <ResetScreen />
        </Suspense>
      );
    case 'app':
      return <Shell />;
  }
}
