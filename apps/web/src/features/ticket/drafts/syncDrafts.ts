import { ApiError } from '@tracker/client';
import type { TicketDetail } from '@tracker/shared';
import { isNotFound, projectOfTicket } from '../../../api';
import {
  draftSaved,
  forgetDraft,
  forgetTicketDrafts,
  storedDrafts,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { finishSave, isSavingAnywhere, startSave } from '../fields/fieldSaves';
import { checkDraft, serverText } from './draftCheck';
import { isLeftToScreen, retryLiveDrafts } from './liveDrafts';

export interface DraftSyncDeps {
  // A fresh read: an answer saved before someone else's change would let the sync save over it.
  fetchTicket: (ticketKey: string) => Promise<TicketDetail>;
  save: (draft: StoredDraft) => Promise<unknown>;
}

type Entry = [id: string, draft: StoredDraft];

export interface DraftSyncReport {
  changed: Entry[];
}

// The closed tickets a run reads: all, or those in the projects a reported change touched.
export type SyncScope = 'all' | ReadonlySet<string>;

interface Run {
  deps: DraftSyncDeps;
  report: DraftSyncReport;
}

// Drafts on screen retry themselves, so only drafts left in closed tickets are synced here. A
// draft with saves on its way, in this tab or another, is theirs to settle: the tracker may have
// the first of them without having answered, which a check would take for someone else's change.
const isSettledElsewhere = (id: string, ticketKey: string): boolean =>
  isLeftToScreen(id, ticketKey) || isSavingAnywhere(id);

const inScope = (ticketKey: string, scope: SyncScope): boolean =>
  scope === 'all' || scope.has(projectOfTicket(ticketKey) ?? '');

function closedTicketDrafts(scope: SyncScope): Map<string, Entry[]> {
  const byTicket = new Map<string, Entry[]>();
  for (const [id, draft] of storedDrafts()) {
    if (!inScope(draft.ticketKey, scope) || isSettledElsewhere(id, draft.ticketKey)) continue;
    byTicket.set(draft.ticketKey, [...(byTicket.get(draft.ticketKey) ?? []), [id, draft]]);
  }
  return byTicket;
}

export const hasClosedDrafts = (scope: SyncScope = 'all'): boolean =>
  closedTicketDrafts(scope).size > 0;

// The text of each draft the tracker refused (a 4xx other than 404). It isn't sent again by later
// runs, which would only be refused again, until its text changes; on its ticket's screen the
// field says it isn't saved and retries it there.
const refused = new Map<string, string>();

export const clearRefusedDrafts = (): void => refused.clear();

// The comment box is never sent for the user, nor an edit nobody pressed Save for. Their
// tickets are still read, so their text goes once the ticket or comment is gone.
const isSentForUser = (draft: StoredDraft): boolean =>
  draft.field === 'comment-edit' ? draft.submitted === true : draft.field !== 'comment';

// Only a tracker that can't be reached (no answer, 401, 5xx) ends a run. Any other refusal is the
// draft's own: it waits on its ticket, where the field says it isn't saved, and the rest go on.
const endsRun = (error: unknown): boolean =>
  !(error instanceof ApiError) || error.status === 401 || error.status >= 500;

async function save([id, draft]: Entry, run: Run): Promise<boolean> {
  const number = startSave(id, draft.text);
  try {
    await run.deps.save(draft);
  } catch (error) {
    finishSave(id, number, false);
    if (isNotFound(error)) forgetDraft(id);
    else if (!endsRun(error)) refused.set(id, draft.text);
    return !endsRun(error);
  }
  finishSave(id, number, true);
  return true;
}

async function syncDraft(entry: Entry, detail: TicketDetail, run: Run): Promise<boolean> {
  const [id, draft] = entry;
  // A save may have started while the ticket was read.
  if (draft.field === 'comment' || isSavingAnywhere(id)) return true;
  const check = checkDraft(draft, serverText(detail, draft));
  if (check === 'gone') {
    forgetDraft(id);
    return true;
  }
  if (check === 'saved') {
    draftSaved(id, draft.text);
    return true;
  }
  // The ticket may have opened while it was read.
  if (!isSentForUser(draft) || isLeftToScreen(id, draft.ticketKey)) return true;
  if (check === 'changed') {
    run.report.changed.push(entry);
    return true;
  }
  if (refused.get(id) === draft.text) return true;
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
export async function syncDrafts(
  deps: DraftSyncDeps,
  scope: SyncScope = 'all',
): Promise<DraftSyncReport> {
  const run: Run = { deps, report: { changed: [] } };
  if (scope === 'all') retryLiveDrafts();
  for (const [ticketKey, entries] of closedTicketDrafts(scope)) {
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
