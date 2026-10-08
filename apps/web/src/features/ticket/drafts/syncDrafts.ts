import { ApiError } from '@tracker/client';
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
  // A fresh read: an answer saved before someone else's change would let the sync save over it.
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

// Drafts on screen retry themselves, so only drafts left in closed tickets are synced here.
function closedTicketDrafts(): Map<string, Entry[]> {
  const byTicket = new Map<string, Entry[]>();
  for (const [id, draft] of storedDrafts()) {
    if (isLiveDraft(id)) continue;
    byTicket.set(draft.ticketKey, [...(byTicket.get(draft.ticketKey) ?? []), [id, draft]]);
  }
  return byTicket;
}

export const hasClosedDrafts = (): boolean => closedTicketDrafts().size > 0;

// The comment box is never sent for the user, nor an edit nobody pressed Save for. Their
// tickets are still read, so their text goes once the ticket or comment is gone.
const isSentForUser = (draft: StoredDraft): boolean =>
  draft.field === 'comment-edit' ? draft.submitted === true : draft.field !== 'comment';

// Only a tracker that can't be reached (no answer, 401, 5xx) ends a run. Any other refusal is the
// draft's own: it waits on its ticket, where the field says it isn't saved, and the rest go on.
const endsRun = (error: unknown): boolean =>
  !(error instanceof ApiError) || error.status === 401 || error.status >= 500;

// False when the tracker can't be reached, which ends the run.
async function save([id, draft]: Entry, run: Run): Promise<boolean> {
  try {
    await run.deps.save(draft);
  } catch (error) {
    if (isNotFound(error)) forgetDraft(id);
    return !endsRun(error);
  }
  draftSaved(id, draft.text);
  return true;
}

async function syncDraft(entry: Entry, detail: TicketDetail, run: Run): Promise<boolean> {
  const [id, draft] = entry;
  if (draft.field === 'comment') return true;
  const check = checkDraft(draft, serverText(detail, draft));
  if (check === 'gone') {
    forgetDraft(id);
    return true;
  }
  if (check === 'saved') {
    draftSaved(id, draft.text);
    return true;
  }
  if (!isSentForUser(draft)) return true;
  if (check === 'changed') {
    run.report.changed.push(entry);
    return true;
  }
  return save(entry, run);
}

async function syncTicket(ticketKey: string, entries: Entry[], run: Run): Promise<boolean> {
  let detail: TicketDetail;
  try {
    detail = await run.deps.fetchTicket(ticketKey);
  } catch (error) {
    if (isNotFound(error)) forgetTicketDrafts(ticketKey);
    return !endsRun(error);
  }
  for (const entry of entries) {
    if (!(await syncDraft(entry, detail, run))) return false;
  }
  return true;
}

// Saves drafts only while the tracker still has the value they were typed over, and drops the
// drafts of tickets and comments that are gone.
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
