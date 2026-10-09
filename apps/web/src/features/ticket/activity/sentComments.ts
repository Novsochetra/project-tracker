import type { TicketDetail } from '@tracker/shared';
import { entriesOf } from '../../../lib/entries';
import {
  draftIdOf,
  forgetDraft,
  keepDraft,
  storedDraft,
  type DraftTarget,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { finishSave, startSave } from '../fields/fieldSaves';

// A comment on its way is kept in the drafts store under an id of its own until it lands, so a
// page that closes or reloads meanwhile doesn't lose it: closing asks first, since kept text
// counts as a draft, and a page that goes anyway puts it back in the comment box. Its files are
// not kept.

const boxOf = (ticketKey: string): DraftTarget => ({ ticketKey, field: 'comment' });

// What the drafts store keeps for the comment box: spaces alone are not kept.
export const keptForm = (text: string): string | undefined => (text.trim() ? text : undefined);

export const keptComment = (ticketKey: string): string | undefined =>
  keptForm(storedDraft(draftIdOf(boxOf(ticketKey)))?.text ?? '');

export function keepComment(ticketKey: string, text: string): void {
  const target = boxOf(ticketKey);
  if (keptForm(text)) keepDraft(draftIdOf(target), { ...target, text }, '');
  else forgetDraft(draftIdOf(target));
}

// Before anything typed meanwhile, here or in another tab, also after the screen has closed. A
// comment of files only has no text to bring back.
export function handBackComment(ticketKey: string, text: string): void {
  const typed = keptComment(ticketKey);
  if (!keptForm(text) || typed === text) return;
  keepComment(ticketKey, typed ? `${text}\n${typed}` : text);
}

export interface CommentSend {
  id: string;
  number: number;
  ticketKey: string;
  text: string;
}

const onTheirWay = new Map<string, CommentSend>();

// The page is going for good (not kept to show again), and its requests with it.
function onPageGone(event: PageTransitionEvent): void {
  if (event.persisted) return;
  for (const send of onTheirWay.values()) {
    handBackComment(send.ticketKey, send.text);
    forgetDraft(send.id);
  }
  onTheirWay.clear();
}

// `seen`: how many of the ticket's comments have the text now, so a later check can tell whether
// it landed.
export function startSend(ticketKey: string, text: string, seen: number): CommentSend {
  const sendId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const target: DraftTarget = { ticketKey, field: 'comment-send', activityId: sendId };
  const id = draftIdOf(target);
  keepDraft(id, { ...target, text }, String(seen));
  const send = { id, number: startSave(id, text), ticketKey, text };
  if (onTheirWay.size === 0) window.addEventListener('pagehide', onPageGone);
  onTheirWay.set(id, send);
  return send;
}

// A failed comment comes back in the box; one that landed lets its kept text go.
export function endSend(send: CommentSend, landed: boolean): void {
  if (!onTheirWay.delete(send.id)) return;
  if (onTheirWay.size === 0) window.removeEventListener('pagehide', onPageGone);
  finishSave(send.id, send.number, landed);
  if (landed) return;
  handBackComment(send.ticketKey, send.text);
  forgetDraft(send.id);
}

// Tests start with no comment on its way, whatever the test before them left hanging.
export function clearSends(): void {
  onTheirWay.clear();
  window.removeEventListener('pagehide', onPageGone);
}

export const commentsWithText = (detail: TicketDetail, text: string): number =>
  entriesOf(detail.activity).filter((item) => item.type === 'comment' && item.text === text).length;

// A comment left on its way by a page that went without a word (killed, or crashed), once no tab
// has it on its way: it landed if the ticket has more comments with its text than when it was
// sent; otherwise it goes back in the box.
export function settleLeftSend(id: string, draft: StoredDraft, detail: TicketDetail): void {
  if (!storedDraft(id)) return;
  if (commentsWithText(detail, draft.text) <= (Number(draft.base) || 0)) {
    handBackComment(draft.ticketKey, draft.text);
  }
  forgetDraft(id);
}
