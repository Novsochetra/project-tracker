import { draftStorage } from './draftStorage';

// A sheet such as New ticket reads its fields back itself, so here they are any object.
export type SheetValues = Readonly<Record<string, unknown>>;

export const SHEET_DRAFTS_STORAGE_KEY = 'tracker.sheetDrafts';

const isValues = (value: unknown): value is SheetValues =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const { load, store } = draftStorage(SHEET_DRAFTS_STORAGE_KEY, isValues);

export const sheetDraft = (id: string): SheetValues | undefined => load()[id];

export function keepSheetDraft(id: string, values: SheetValues): void {
  store({ ...load(), [id]: values });
}

export function forgetSheetDraft(id: string): void {
  const { [id]: forgotten, ...rest } = load();
  if (forgotten) store(rest);
}
