import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { TrackerClient } from '@tracker/client';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiContext } from './context';
import { createQueryClient } from './queryClient';
import { watchUnauthorized } from './unauthorized';

export interface ApiProviderProps {
  client?: TrackerClient;
  queryClient?: QueryClient;
  children: ReactNode;
}

const createDefaults = () => ({
  client: new TrackerClient({ baseUrl: '' }),
  queryClient: createQueryClient(),
});

export function ApiProvider({ client, queryClient, children }: ApiProviderProps) {
  const [defaults] = useState(createDefaults);
  const activeClient = client ?? defaults.client;
  const activeQueryClient = queryClient ?? defaults.queryClient;

  useEffect(() => watchUnauthorized(activeQueryClient), [activeQueryClient]);

  return (
    <QueryClientProvider client={activeQueryClient}>
      <ApiContext value={activeClient}>{children}</ApiContext>
    </QueryClientProvider>
  );
}
