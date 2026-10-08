import type { StoredDraft } from '../../../lib/storedDrafts';
import type { CheckResult } from '../drafts/useDraftCheck';

export type EditPhase = 'idle' | 'editing' | 'saving' | 'failed' | 'changed' | 'closed';

export interface EditState {
  phase: EditPhase;
  // Kept from an earlier visit, or a save of it failed: the comment may have changed elsewhere
  // meanwhile, so the edit is only sent once the tracker says it still has the text it was
  // typed over.
  checkFirst: boolean;
}

export type SentBy = 'user' | 'app';

const OPEN_PHASES: ReadonlySet<EditPhase> = new Set(['editing', 'saving', 'failed', 'changed']);

export const isOpen = (edit: EditState): boolean => OPEN_PHASES.has(edit.phase);

export const STARTED: EditState = { phase: 'editing', checkFirst: false };

// An edit whose Save failed opens failed and is retried. One nobody saved opens as it was left
// and is only ever sent by Save.
export function restoredEdit(kept: StoredDraft | undefined): EditState {
  if (!kept) return { phase: 'idle', checkFirst: false };
  return { phase: kept.submitted ? 'failed' : 'editing', checkFirst: true };
}

export const withPhase = (edit: EditState, phase: EditPhase): EditState => ({ ...edit, phase });

// Typing over a save in flight or a failed one starts a new edit, which Save has to send.
export const afterTyping = (edit: EditState): EditState =>
  edit.phase === 'saving' || edit.phase === 'failed' ? withPhase(edit, 'editing') : edit;

export type SaveStep = 'ignore' | 'close' | 'replace' | 'check' | 'send';

export function saveStep(edit: EditState, text: string, comment: string): SaveStep {
  if (edit.phase === 'saving') return 'ignore';
  if (text.trim() === comment) return 'close';
  if (edit.phase === 'changed') return 'replace';
  return edit.checkFirst ? 'check' : 'send';
}

// A check counts only for the text it was started for: the app's retry while the edit is still
// the failed one, the user's Save while it waits for the check. Typing or Cancel meanwhile made
// a new edit, or none.
export const checkApplies = (edit: EditState, by: SentBy): boolean =>
  edit.phase === (by === 'app' ? 'failed' : 'saving');

export type CheckStep = 'send' | 'changed' | 'drop' | 'wait';

export function checkStep(result: CheckResult): CheckStep {
  switch (result) {
    case 'unchanged':
      return 'send';
    case 'changed':
      return 'changed';
    case 'saved':
    case 'gone':
      return 'drop';
    case 'unreachable':
    case null:
      return 'wait';
  }
}

// A Save that couldn't check leaves the edit failed, like one whose save failed, so the app
// retries it once the tracker answers again.
export function afterCheck(edit: EditState, step: CheckStep): EditState {
  if (step === 'changed') return withPhase(edit, 'changed');
  if (step === 'drop') return withPhase(edit, 'closed');
  return step === 'wait' && edit.phase === 'saving' ? withPhase(edit, 'failed') : edit;
}

// The editor stays open until the edit is saved, and a failed edit reopens it with its text.
// Text typed since Save was pressed is a new edit, which waits for Save.
export function afterSave(edit: EditState, saved: boolean): EditState {
  if (saved) return { phase: edit.phase === 'saving' ? 'closed' : edit.phase, checkFirst: false };
  return { phase: edit.phase === 'editing' ? 'editing' : 'failed', checkFirst: true };
}
