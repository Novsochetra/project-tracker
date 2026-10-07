import type { TrackerClient } from '@tracker/client';
import { createContext, useContext } from 'react';

export const ApiContext = createContext<TrackerClient | null>(null);

export function useApi(): TrackerClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error('useApi must be used inside <ApiProvider>.');
  return client;
}
