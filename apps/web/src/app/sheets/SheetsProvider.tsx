import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { SheetsContext, type SheetsApi } from './context';
import { SheetHost } from './SheetHost';
import type { SheetRequest } from './types';

interface State {
  request: SheetRequest | null;
  open: boolean;
  id: number;
}

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ request: null, open: false, id: 0 });
  const open = useCallback(
    (request: SheetRequest) => setState((current) => ({ request, open: true, id: current.id + 1 })),
    [],
  );
  const close = useCallback(() => setState((current) => ({ ...current, open: false })), []);
  const api = useMemo<SheetsApi>(
    () => ({ open, close, current: state.open ? state.request : null }),
    [open, close, state],
  );
  return (
    <SheetsContext.Provider value={api}>
      {children}
      {/* A new key per request, so every sheet opens with a fresh form. */}
      <SheetHost key={state.id} request={state.request} open={state.open} onClose={close} />
    </SheetsContext.Provider>
  );
}
