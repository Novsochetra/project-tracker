import { useEffect, useRef } from 'react';
import { ConfirmCard } from '../../../components';
import { useIsPhone } from '../../../lib/media';
import { ActionSheet } from '../../../overlays';
import type { ImageRemoval } from './useImageRemoval';

/** Phones confirm in an action sheet; desktop in a card under the images, like Delete ticket. */
export function RemoveImageConfirm({ removal }: { removal: ImageRemoval }) {
  const isPhone = useIsPhone();
  const message = `Remove image ${removal.target?.number ?? ''}? This can't be undone.`;
  if (isPhone) {
    return (
      <ActionSheet
        open={removal.asking}
        onClose={removal.cancel}
        label="Remove image"
        caption={message}
        actions={[{ label: 'Remove image', tone: 'danger', bold: true, onSelect: removal.confirm }]}
      />
    );
  }
  return removal.asking ? <InlineConfirm message={message} removal={removal} /> : null;
}

function InlineConfirm({ message, removal }: { message: string; removal: ImageRemoval }) {
  const ref = useRef<HTMLDivElement>(null);
  // The card moves focus to Cancel without scrolling, so one that opens out of view is shown.
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  return (
    <div ref={ref}>
      <ConfirmCard
        message={message}
        confirmLabel="Remove"
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
      />
    </div>
  );
}
