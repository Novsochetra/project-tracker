import { useRef, type PointerEvent, type RefObject } from 'react';

// As in Apple's menus, the row under the mouse is highlighted, and the highlight leaves with the
// mouse. Hovering moves focus to the row, so the arrows go on from there; leaving hands focus back
// to the menu, unless the keys moved it since, so a row the keys reached stays highlighted.
export function useHoverFocus(menuRef: RefObject<HTMLElement | null>) {
  const byPointer = useRef(false);

  return {
    onRowPointerMove: (event: PointerEvent<HTMLElement>) => {
      const row = event.currentTarget;
      if (event.pointerType !== 'mouse' || row === document.activeElement) return;

      row.focus({ preventScroll: true });
      byPointer.current = true;
    },

    onMenuPointerLeave: (event: PointerEvent<HTMLElement>) => {
      if (event.pointerType !== 'mouse' || !byPointer.current) return;

      byPointer.current = false;
      // A pick that closed the menu has already put focus back on its row; it stays there.
      const menu = menuRef.current;
      if (menu?.contains(document.activeElement)) menu.focus({ preventScroll: true });
    },

    onKey: () => {
      byPointer.current = false;
    },
  };
}
