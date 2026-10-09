import type { QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import { BrowserRouter } from 'react-router';
import { ApiProvider, useSession } from '../api';
import { ToastProvider } from '../components';
import { useFileDropGuard } from '../features/attachments';
import { useTicketDrafts } from '../features/ticket/drafts/useTicketDrafts';
import { NavigationProvider } from '../navigation';
import { screensOnTheirWay } from './lazyParts';
import { LoginScreen } from './LoginScreen';
import { gateFor } from './sessionGate';
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
  const gate = gateFor({ data, fetchStatus });
  useTicketDrafts(gate === 'app');
  switch (gate) {
    case 'loading':
      return null;
    case 'login':
      return <LoginScreen setupRequired={data?.setupRequired === true} />;
    case 'app':
      return <Shell />;
  }
}
