import { CLICK_SHIELD_MS } from '../lib/clickShield';

// A close that comes later than a double tap's second tap could: the sheet, still open, took it.
export const closedByClick = (clickedAt: number | null, closedAt: number): boolean =>
  clickedAt !== null && closedAt - clickedAt < CLICK_SHIELD_MS;
