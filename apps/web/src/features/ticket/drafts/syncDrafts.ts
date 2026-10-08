import type { TicketDetail } from '@tracker/shared';
import { isNotFound } from '../../../api';
import {
  draftSaved,
  forgetDraft,
  forgetTicketDrafts,
  storedDrafts,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { checkDraft, serverText } from './draftCheck';
import { isLiveDraft, retryLiveDrafts } from './liveDrafts';

export interface DraftSyncDeps {
  fetchTicket: (ticketKey: string) => Promise<TicketDetail>;
  save: (draft: StoredDraft) => Promise<unknown>;
}

type Entry = [id: string, draft: StoredDraft];

export interface DraftSyncReport {
  // Drafts someone else's change got in the way of; they wait for the user on the ticket.
  changed: Entry[];
}

interface Run {
  deps: DraftSyncDeps;
  report: DraftSyncReport;
}

// Text typed in the comment box is never sent for the user, and drafts on screen retry
// themselves, so only drafts left in closed tickets are synced here.
function closedTicketDrafts(): Map<string, Entry[]> {
  const byTicket = new Map<string, Entry[]>();
  for (const [id, draft] of storedDrafts()) {
    if (draft.field === 'comment' || isLiveDraft(id)) continue;
    byTicket.set(draft.ticketKey, [...(byTicket.get(draft.ticketKey) ?? []), [id, draft]]);
  }
  return byTicket;
}

// False when the tracker can't be reached, which ends the run.
async function syncDraft([id, draft]: Entry, detail: TicketDetail, run: Run): Promise<boolean> {
  const check = checkDraft(draft, serverText(detail, draft));
  if (check === 'changed') {
    run.report.changed.push([id, draft]);
    return true;
  }
  if (check === 'gone') {
    forgetDraft(id);
    return true;
  }
  try {
    if (check === 'unchanged') await run.deps.save(draft);
  } catch (error) {
    if (!isNotFound(error)) return false;
    forgetDraft(id);
    return true;
  }
  draftSaved(id, draft.text);
  return true;
}

async function syncTicket(ticketKey: string, entries: Entry[], run: Run): Promise<boolean> {
  let detail: TicketDetail;
  try {
    detail = await run.deps.fetchTicket(ticketKey);
  } catch (error) {
    if (!isNotFound(error)) return false;
    forgetTicketDrafts(ticketKey);
    return true;
  }
  for (const entry of entries) {
    if (!(await syncDraft(entry, detail, run))) return false;
  }
  return true;
}

// Saves drafts only while the tracker still has the value they were typed over.
export async function syncDrafts(deps: DraftSyncDeps): Promise<DraftSyncReport> {
  const run: Run = { deps, report: { changed: [] } };
  retryLiveDrafts();
  for (const [ticketKey, entries] of closedTicketDrafts()) {
    if (!(await syncTicket(ticketKey, entries, run))) break;
  }
  return run.report;
}

let running: Promise<void> | null = null;
let again = false;

// One run at a time; a reconnect during a run gets a run of its own once it ends.
export function runDraftSync(sync: () => Promise<void>): void {
  if (running) {
    again = true;
    return;
  }
  const loop = async () => {
    do {
      again = false;
      await sync();
    } while (again);
  };
  running = loop().finally(() => {
    running = null;
  });
}
