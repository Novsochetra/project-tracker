import type { QueryClient } from '@tanstack/react-query';
import type { TrackerClient } from '@tracker/client';
import { BrowserRouter } from 'react-router';
import { ApiProvider, useSession } from '../api';
import { ToastProvider } from '../components';
import { useFileDropGuard } from '../features/attachments';
import { NavigationProvider } from '../navigation';
import { gateFor } from './sessionGate';
import { SheetsProvider } from './sheets/SheetsProvider';
import { Shell } from './Shell';
import { TokenScreen } from './TokenScreen';

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
          <NavigationProvider>
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
  switch (gateFor({ data, fetchStatus })) {
    case 'loading':
      return null;
    case 'token':
      return <TokenScreen />;
    case 'app':
      return <Shell />;
  }
}
