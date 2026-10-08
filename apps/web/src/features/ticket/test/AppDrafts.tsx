import { useTicketDrafts } from '../drafts/useTicketDrafts';

// TrackerApp saves kept drafts on start and on reconnect; these tests render the screen alone.
export function AppDrafts() {
  useTicketDrafts(true);
  return null;
}
