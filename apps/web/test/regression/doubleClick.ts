import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { advance } from './stillClock';

// jsdom has no layout, so this stands in for the browser's hit test at the spot of the first
// click: the popover's topmost element there that still takes clicks, else a click-catching
// layer over the page, else what lies under the popover.
export function hitTest(spot: Element, under: Element): Element {
  for (let node: Element | null = spot; node && node !== document.body; node = node.parentElement) {
    if (node.isConnected && !node.closest('[inert]')) return node;
  }
  return screen.queryByRole('button', { name: /^Close (menu|calendar)$/, hidden: true }) ?? under;
}

export type User = ReturnType<typeof userEvent.setup>;

// With the clock stopped (stillClock), so a busy machine can't stretch the gap past the shield.
export async function doubleClick(user: User, spot: Element, under: Element, gap: number) {
  await user.click(spot);
  if (gap > 0) await advance(gap);
  await user.click(hitTest(spot, under));
}

export const GAPS = [0, 120, 200];
