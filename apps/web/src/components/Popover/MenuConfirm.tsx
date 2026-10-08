import { useLayoutEffect, useRef, type MouseEvent } from 'react';
import { ConfirmCard, type ConfirmCardProps } from '../ConfirmCard';
import { CLICK_SHIELD_MS } from '../FloatingPanel/floatingHooks';

export type MenuConfirmProps = Omit<ConfirmCardProps, 'variant'>;

// The confirm takes the place of the item that asked for it, and the menu is placed again for its
// new size, so one of its buttons can land under the pointer: a double-click's second click would
// press Delete. So for CLICK_SHIELD_MS it takes no clicks from a pointer, and a press it ignores
// leaves focus on Cancel. Keyboard presses (detail 0) are deliberate and go through.
export function MenuConfirm(props: MenuConfirmProps) {
  const shownAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    shownAt.current = performance.now();
  }, []);
  const shield = (event: MouseEvent) => {
    const since = shownAt.current;
    if (event.detail === 0 || (since !== null && performance.now() - since >= CLICK_SHIELD_MS)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  return (
    <div role="presentation" onMouseDownCapture={shield} onClickCapture={shield}>
      <ConfirmCard variant="menu" {...props} />
    </div>
  );
}
