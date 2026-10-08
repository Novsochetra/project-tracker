// The saves of one field that went out, numbered from 1 in the order they were sent. On a slow
// connection several can be on their way, and the tracker ends with the latest one's text.
export interface SentSaves {
  latest: number;
  // The text of each save still on its way.
  onTheirWay: ReadonlyMap<number, string>;
  // The newest save that landed.
  landed: number;
}

export const NO_SAVES: SentSaves = { latest: 0, onTheirWay: new Map(), landed: 0 };

// skip: the latest save sent carries this text and is still on its way, so its outcome settles
// the field. unchanged: nothing is on its way and the tracker already shows this text. send:
// anything else, and always for a retry that checked the tracker first.
export type SaveStep = 'skip' | 'unchanged' | 'send';

export interface SaveRequest {
  value: string;
  // What the cache shows for the field, which may be the optimistic copy of a save.
  shown: string;
  checked: boolean;
}

export function saveStep(saves: SentSaves, { value, shown, checked }: SaveRequest): SaveStep {
  if (checked) return 'send';
  if (saves.onTheirWay.get(saves.latest) === value) return 'skip';
  return saves.onTheirWay.size === 0 && value === shown ? 'unchanged' : 'send';
}

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
