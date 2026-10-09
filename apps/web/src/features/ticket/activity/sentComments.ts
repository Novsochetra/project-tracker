import type { TicketDetail } from '@tracker/shared';
import { entriesOf } from '../../../lib/entries';
import {
  draftIdOf,
  forgetDraft,
  keepDraft,
  storedDraft,
  storedDrafts,
  type DraftTarget,
  type StoredDraft,
} from '../../../lib/storedDrafts';
import { finishSave, startSave } from '../fields/fieldSaves';

// A comment on its way is kept in the drafts store under an id of its own until it lands, so a
// page that closes or reloads meanwhile doesn't lose it: closing asks first, since kept text
// counts as a draft. Its files are not kept.

const boxOf = (ticketKey: string): DraftTarget => ({ ticketKey, field: 'comment' });

const newId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

// What the drafts store keeps for the comment box: spaces alone are not kept.
export const keptForm = (text: string): string | undefined => (text.trim() ? text : undefined);

// Comments that came back to the box (their send failed, or they never landed), newest first.
// Each stays a record of its own until typing in the box, which shows it, takes it in: written
// into the box's text, a tab's comment could replace typing another tab did a moment before, and
// that tab, typing on, could replace the comment.
function backsOf(ticketKey: string): Array<[string, StoredDraft]> {
  return storedDrafts()
    .filter(([, draft]) => draft.field === 'comment-back' && draft.ticketKey === ticketKey)
    .sort(([, a], [, b]) => (b.at ?? 0) - (a.at ?? 0));
}

export const backIdsOf = (ticketKey: string): string[] => backsOf(ticketKey).map(([id]) => id);

// The box's kept text: the comments that came back, then what was typed.
export function keptComment(ticketKey: string): string | undefined {
  const typed = storedDraft(draftIdOf(boxOf(ticketKey)))?.text ?? '';
  const texts = [...backsOf(ticketKey).map(([, draft]) => draft.text), typed];
  return keptForm(texts.filter((text) => keptForm(text)).join('\n'));
}

// `shown`: the comments back in the box when it showed the text this was typed from, which the
// text now holds.
export function keepComment(ticketKey: string, text: string, shown: readonly string[] = []): void {
  const target = boxOf(ticketKey);
  if (keptForm(text)) keepDraft(draftIdOf(target), { ...target, text }, '');
  else forgetDraft(draftIdOf(target));
  shown.forEach(forgetDraft);
}

// Before anything typed meanwhile, here or in another tab, also after the screen has closed. A
// comment of files only has no text to bring back.
export function handBackComment(ticketKey: string, text: string, sendId = newId()): void {
  if (!keptForm(text) || keptComment(ticketKey) === text) return;
  const target: DraftTarget = { ticketKey, field: 'comment-back', activityId: sendId };
  keepDraft(draftIdOf(target), { ...target, text }, '');
}

export interface CommentSend {
  id: string;
  sendId: string;
  number: number;
  ticketKey: string;
  text: string;
}

const onTheirWay = new Map<string, CommentSend>();

function stopSending(send: CommentSend, landed: boolean): void {
  onTheirWay.delete(send.id);
  if (onTheirWay.size === 0) window.removeEventListener('pagehide', onPageGone);
  finishSave(send.id, send.number, landed);
}

// The page is going for good (not kept to show again), and its requests with it. One may have
// reached the tracker without its answer reaching the page, so the comment isn't put back now:
// it stays kept for the app-wide sync, which reads the ticket first (in another open tab, or at
// the next start).
function onPageGone(event: PageTransitionEvent): void {
  if (event.persisted) return;
  [...onTheirWay.values()].forEach((send) => stopSending(send, false));
}

// `seen`: how many of the ticket's comments have the text now, so a later check can tell whether
// it landed.
export function startSend(ticketKey: string, text: string, seen: number): CommentSend {
  const sendId = newId();
  const target: DraftTarget = { ticketKey, field: 'comment-send', activityId: sendId };
  const id = draftIdOf(target);
  keepDraft(id, { ...target, text }, String(seen));
  const send = { id, sendId, number: startSave(id, text), ticketKey, text };
  if (onTheirWay.size === 0) window.addEventListener('pagehide', onPageGone);
  onTheirWay.set(id, send);
  return send;
}

// A failed comment comes back in the box; one that landed lets its kept text go.
export function endSend(send: CommentSend, landed: boolean): void {
  if (!onTheirWay.has(send.id)) return;
  stopSending(send, landed);
  if (landed) return;
  handBackComment(send.ticketKey, send.text, send.sendId);
  forgetDraft(send.id);
}

// Tests start with no comment on its way, whatever the test before them left hanging.
export function clearSends(): void {
  onTheirWay.clear();
  window.removeEventListener('pagehide', onPageGone);
}

export const commentsWithText = (detail: TicketDetail, text: string): number =>
  entriesOf(detail.activity).filter((item) => item.type === 'comment' && item.text === text).length;

// A comment left on its way by a page that went, once no tab has it on its way: it landed if the
// ticket has more comments with its text than when it was sent; otherwise it goes back in the
// box.
export function settleLeftSend(id: string, draft: StoredDraft, detail: TicketDetail): void {
  if (!storedDraft(id)) return;
  if (commentsWithText(detail, draft.text) <= (Number(draft.base) || 0)) {
    handBackComment(draft.ticketKey, draft.text, draft.activityId);
  }
  forgetDraft(id);
}
