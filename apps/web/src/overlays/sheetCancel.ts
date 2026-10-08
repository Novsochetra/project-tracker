import { createContext, useContext } from 'react';

export const SheetCancelContext = createContext<(() => void) | null>(null);

export function useSheetCancel(): () => void {
  const cancel = useContext(SheetCancelContext);
  if (!cancel) throw new Error('SheetCancelButton needs a Sheet');
  return cancel;
}
