import { useIsPhone } from '../../lib/media';
import type { DoneBatch } from './doneBatch';
import { MoveAllMenu } from './MoveAllMenu';
import { MoveAllSheet } from './MoveAllSheet';

export interface MoveAllProps {
  batch: DoneBatch;
  // The double check alone, for a board column's header.
  compact?: boolean;
  // The button leaves with the tickets, so the card or group says where focus goes instead; the
  // move settles once it is saved or refused.
  onMove: (moving: Promise<unknown>) => void;
  className?: string | undefined;
}

export interface MoveAllToDoneProps extends Omit<MoveAllProps, 'batch' | 'compact'> {
  batch: DoneBatch | null;
  place: 'header' | 'footer' | 'column';
}

// In the header on a desktop. A phone's header has no room left beside Show less and the + (at
// 320px not even for an icon), so there it is the card's last row, below Show more. A board
// column's header has room for the icon alone everywhere, as it never holds Show less.
const shownIn = (place: MoveAllToDoneProps['place'], isPhone: boolean): boolean =>
  place === 'column' || isPhone === (place === 'footer');

export function MoveAllToDone({ batch, place, ...props }: MoveAllToDoneProps) {
  const isPhone = useIsPhone();
  if (!batch || !shownIn(place, isPhone)) return null;

  const compact = place === 'column';

  return isPhone ? (
    <MoveAllSheet batch={batch} compact={compact} {...props} />
  ) : (
    <MoveAllMenu batch={batch} compact={compact} {...props} />
  );
}
