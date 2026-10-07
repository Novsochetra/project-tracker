import { createContext, useContext } from 'react';
import type { SheetRequest } from './types';

export interface SheetsApi {
  open: (request: SheetRequest) => void;
  close: () => void;
  current: SheetRequest | null;
}

export const SheetsContext = createContext<SheetsApi | null>(null);

export function useSheets(): SheetsApi {
  const api = useContext(SheetsContext);
  if (!api) throw new Error('useSheets needs a SheetsProvider');
  return api;
}
