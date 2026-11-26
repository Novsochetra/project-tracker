import { useIsPhone } from '../../lib/media';
import type { DoneBatch } from './doneBatch';
import { MoveAllMenu } from './MoveAllMenu';
import { MoveAllSheet } from './MoveAllSheet';

export interface MoveAllProps {
  batch: DoneBatch;
  // The button leaves with the tickets, so the card or group says where focus goes instead; the
  // move settles once it is saved or refused.
  onMove: (moving: Promise<unknown>) => void;
  className?: string | undefined;
}

export interface MoveAllToDoneProps extends Omit<MoveAllProps, 'batch'> {
  batch: DoneBatch | null;
  place: 'header' | 'footer';
}

// In the header on a desktop. A phone's header has no room left beside Show less and the + (at
// 320px not even for an icon), so there it is the card's last row, below Show more.
export function MoveAllToDone({ batch, place, ...props }: MoveAllToDoneProps) {
  const isPhone = useIsPhone();
  if (!batch || isPhone !== (place === 'footer')) return null;

  return isPhone ? (
    <MoveAllSheet batch={batch} {...props} />
  ) : (
    <MoveAllMenu batch={batch} {...props} />
  );
}
