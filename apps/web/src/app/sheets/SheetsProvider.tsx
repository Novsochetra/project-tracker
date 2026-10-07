import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { SheetsContext, type SheetsApi } from './context';
import { SheetHost } from './SheetHost';
import type { SheetRequest } from './types';

interface State {
  request: SheetRequest | null;
  open: boolean;
}

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ request: null, open: false });
  const open = useCallback((request: SheetRequest) => setState({ request, open: true }), []);
  const close = useCallback(() => setState((current) => ({ ...current, open: false })), []);
  const api = useMemo<SheetsApi>(
    () => ({ open, close, current: state.open ? state.request : null }),
    [open, close, state],
  );
  return (
    <SheetsContext.Provider value={api}>
      {children}
      <SheetHost request={state.request} open={state.open} onClose={close} />
    </SheetsContext.Provider>
  );
}
