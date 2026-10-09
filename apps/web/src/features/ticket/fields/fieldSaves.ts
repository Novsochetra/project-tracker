import { draftSaved, rebaseDraft } from '../../../lib/storedDrafts';
import { isSentElsewhere, markSending, onOtherTabsMarks } from './saveMarks';

// On a slow connection several saves of one field can be on their way, and the tracker ends with
// the latest one's text.
export interface SentSaves {
  latest: number;
  onTheirWay: ReadonlyMap<number, string>;
  landed: number;
}

export const NO_SAVES: SentSaves = { latest: 0, onTheirWay: new Map(), landed: 0 };

// The latest save sent carries this text and is still on its way, so its outcome settles it.
export const carries = (saves: SentSaves, value: string): boolean =>
  saves.onTheirWay.get(saves.latest) === value;

export type SaveStep = 'skip' | 'unchanged' | 'send';

export interface SaveRequest {
  value: string;
  // What the tracker has for the field as far as this tab knows: the cache, which may be the
  // optimistic copy of a save, or the text another tab's save landed before this tab read it.
  shown: string;
  checked: boolean;
  // Another tab has a save of the field on its way, so the tracker may have that save's text by
  // now, whatever this tab shows.
  sentElsewhere?: boolean;
  // The base of the kept text: what the tracker had when a save of it last landed, in any tab.
  // When it disagrees with `shown`, either may be out of date, so the save goes and the tracker
  // decides (it refuses one typed over text it no longer has).
  base?: string | undefined;
}

export function saveStep(saves: SentSaves, request: SaveRequest): SaveStep {
  const { value, shown, checked, sentElsewhere = false, base = value } = request;
  if (checked) return 'send';
  if (carries(saves, value)) return 'skip';
  const settled = saves.onTheirWay.size === 0 && !sentElsewhere;
  return settled && value === shown && value === base ? 'unchanged' : 'send';
}

// The text the tracker has just before the next save lands, as far as this tab knows: the latest
// save still on its way, else the text the kept text was typed over.
export const typedOver = (saves: SentSaves, base: string): string =>
  saves.onTheirWay.get(saves.latest) ?? base;

export function sendSave(saves: SentSaves, value: string): SentSaves {
  const latest = saves.latest + 1;
  return { ...saves, latest, onTheirWay: new Map(saves.onTheirWay).set(latest, value) };
}

// What a settled save means for the kept text. done: it was the latest save sent, so its text
// is what the tracker keeps. rebase: an older one landed, so the tracker has its text for now,
// which a later check compares with, but a newer save is still on its way. keep: it failed, or a
// newer save landed before it.
export type SaveOutcome = 'done' | 'rebase' | 'keep';

export interface SettledSave {
  saves: SentSaves;
  outcome: SaveOutcome;
}

export function settleSave(saves: SentSaves, number: number, saved: boolean): SettledSave {
  const onTheirWay = new Map(saves.onTheirWay);
  onTheirWay.delete(number);
  if (!saved || number < saves.landed) return { saves: { ...saves, onTheirWay }, outcome: 'keep' };
  const outcome = number === saves.latest ? 'done' : 'rebase';
  return { saves: { ...saves, onTheirWay, landed: number }, outcome };
}

// Kept per draft id rather than in a mounted field: the field opened again after leaving the
// ticket, and the app-wide sync, must know about the saves a field that is gone still has on
// their way, or the tracker having the first of them looks like someone else's change.
const sent = new Map<string, SentSaves>();
const listeners = new Set<() => void>();

export const savesOf = (id: string): SentSaves => sent.get(id) ?? NO_SAVES;

export const isSaving = (id: string): boolean => savesOf(id).onTheirWay.size > 0;

// Another tab has saves of the draft on their way, which settle it the same way.
export const isSavingElsewhere = isSentElsewhere;

// Where saves of the draft are on their way. This tab's come first: they settle the field it shows.
export type SavingWhere = 'here' | 'elsewhere' | 'nowhere';

export function savingWhere(id: string): SavingWhere {
  if (isSaving(id)) return 'here';
  return isSavingElsewhere(id) ? 'elsewhere' : 'nowhere';
}

export const isSavingAnywhere = (id: string): boolean => savingWhere(id) !== 'nowhere';

function update(id: string, saves: SentSaves): void {
  if (saves.onTheirWay.size === 0) sent.delete(id);
  else sent.set(id, saves);
  markSending(id, saves.onTheirWay.size > 0);
  listeners.forEach((listener) => listener());
}

export function startSave(id: string, value: string): number {
  const saves = sendSave(savesOf(id), value);
  update(id, saves);
  return saves.latest;
}

export function finishSave(id: string, number: number, saved: boolean): void {
  const value = savesOf(id).onTheirWay.get(number);
  if (value === undefined) return;
  const { saves, outcome } = settleSave(savesOf(id), number, saved);
  if (outcome === 'done') draftSaved(id, value);
  else if (outcome === 'rebase') rebaseDraft(id, value);
  update(id, saves);
}

const waiting = new Map<string, () => void>();

// Runs `run` once no save of the draft is on its way, in this tab or another (a closed tab's marks
// stop counting after a minute, but nothing says when). One wait per draft: its callers all ask
// for the same retry.
export function whenSettled(id: string, run: () => void): void {
  if (!isSavingAnywhere(id)) {
    run();
    return;
  }
  if (waiting.has(id)) return;
  const stop = subscribeSaves(() => {
    if (isSavingAnywhere(id)) return;
    stop();
    waiting.delete(id);
    run();
  });
  waiting.set(id, stop);
}

export function subscribeSaves(listener: () => void): () => void {
  listeners.add(listener);
  const stopMarks = onOtherTabsMarks(listener);
  return () => {
    listeners.delete(listener);
    stopMarks();
  };
}

// Tests start with nothing on its way, whatever the test before them left hanging.
export function clearSaves(): void {
  for (const id of sent.keys()) markSending(id, false);
  sent.clear();
  waiting.forEach((stop) => stop());
  waiting.clear();
}
