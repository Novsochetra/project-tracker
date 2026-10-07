import { createPortal } from 'react-dom';
import { useIsPhone } from '../lib/media';
import { SheetPanel } from './SheetPanel';
import type { SheetProps } from './sheetTypes';
import { usePresence } from './usePresence';

export function Sheet(props: SheetProps) {
  const isPhone = useIsPhone();
  const { mounted, onExited } = usePresence(props.open);
  if (!mounted) return null;
  return createPortal(
    <SheetPanel
      key={isPhone ? 'phone' : 'desktop'}
      {...props}
      isPhone={isPhone}
      onExited={onExited}
    />,
    document.body,
  );
}
