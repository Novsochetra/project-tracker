import type { TicketListItem } from '@tracker/shared';
import { useCallback, useState } from 'react';

export type RowSheetKind = 'status' | 'delete';

export interface RowSheet {
  kind: RowSheetKind;
  ticket: TicketListItem;
  open: boolean;
}

export function useRowSheet() {
  const [sheet, setSheet] = useState<RowSheet | null>(null);
  const show = useCallback(
    (kind: RowSheetKind, ticket: TicketListItem) => setSheet({ kind, ticket, open: true }),
    [],
  );
  // The ticket stays while the sheet slides away, so its caption doesn't vanish mid-exit.
  const close = useCallback(
    () => setSheet((current) => current && { ...current, open: false }),
    [],
  );
  return { sheet, show, close };
}
