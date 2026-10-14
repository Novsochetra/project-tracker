import { parseDiff, type DiffFile, type TicketChanges } from '@tracker/shared';
import { useMemo, useState } from 'react';
import { useTicketChanges } from '../../../api/hooks/changes';
import type { TicketTab } from './TicketTabs';

export interface ChangesTab {
  // Null until a ticket run sent its changes; the screen has no tabs then.
  changes: TicketChanges | null;
  files: DiffFile[];
  tab: TicketTab;
  setTab: (tab: TicketTab) => void;
}

export function useChangesTab(ticketKey: string): ChangesTab {
  const changes = useTicketChanges(ticketKey).data?.changes ?? null;
  const files = useMemo(() => (changes ? parseDiff(changes.diff) : []), [changes]);
  const [tab, setTab] = useState<TicketTab>('ticket');
  return { changes, files, tab: changes ? tab : 'ticket', setTab };
}
