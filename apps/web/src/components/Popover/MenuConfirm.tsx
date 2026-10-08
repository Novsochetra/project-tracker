import { useClickShield } from '../../lib/clickShield';
import { ConfirmCard, type ConfirmCardProps } from '../ConfirmCard';
import { useHoldCloseOnShow } from '../FloatingPanel';

export type MenuConfirmProps = Omit<ConfirmCardProps, 'variant'>;

// The confirm takes the place of the item that asked for it, and the menu is placed again for its
// new size, so one of its buttons can land under the pointer: a double-click's second click would
// press Delete, or, beside a smaller confirm, close the menu. The shield leaves focus on Cancel.
export function MenuConfirm(props: MenuConfirmProps) {
  const shield = useClickShield();
  useHoldCloseOnShow();
  return (
    <div role="presentation" onMouseDownCapture={shield} onClickCapture={shield}>
      <ConfirmCard variant="menu" {...props} />
    </div>
  );
}
