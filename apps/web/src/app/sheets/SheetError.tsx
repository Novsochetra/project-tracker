import { CircleAlert } from 'lucide-react';
import { Button, EmptyState } from '../../components';
import { Sheet, SheetTextButton } from '../../overlays';
import type { SheetProps } from './types';

const reload = () => window.location.reload();

// The sheet frame only, so it still closes every usual way: Close, a swipe down, Escape.
export function SheetError({ open, onClose }: SheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Something went wrong"
      title=""
      left={<SheetTextButton onClick={onClose}>Close</SheetTextButton>}
    >
      <EmptyState
        icon={CircleAlert}
        title="Something went wrong"
        action={<Button onClick={reload}>Reload</Button>}
      />
    </Sheet>
  );
}
