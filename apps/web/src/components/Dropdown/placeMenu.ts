import { placeFloating, type AnchorRect } from '../FloatingPanel';

export type MenuRect = AnchorRect;

export interface PlaceMenuInput {
  triggerRect: MenuRect;
  viewport: { width: number; height: number };
  itemCount: number;
  isPhone: boolean;
}

export interface MenuPlacement {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  up: boolean;
  originX: number;
}

const CHROME = 10;

// The SPEC estimates the menu's height from its items; with many statuses neither side may fit,
// so the menu takes the roomier side and scrolls.
export function placeMenu({
  triggerRect,
  viewport,
  itemCount,
  isPhone,
}: PlaceMenuInput): MenuPlacement {
  const width = isPhone ? 240 : 220;
  const itemHeight = isPhone ? 44 : 36;
  const { top, left, height, up, originX } = placeFloating({
    anchor: triggerRect,
    size: { width, height: itemCount * itemHeight + CHROME },
    viewport,
    minHeight: itemHeight + CHROME,
  });
  return { top, left, width, maxHeight: height, up, originX };
}
