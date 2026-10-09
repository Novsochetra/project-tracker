import { useEffect, useRef } from 'react';
import { ConfirmCard } from '../../../components';
import { useIsPhone } from '../../../lib/media';
import { ActionSheet } from '../../../overlays';
import type { AttachmentRemoval } from './useAttachmentRemoval';

export function RemoveAttachmentConfirm({ removal }: { removal: AttachmentRemoval }) {
  const isPhone = useIsPhone();
  const message = `Remove ${removal.target?.label ?? ''}? This can't be undone.`;
  if (isPhone) {
    const action = `Remove ${removal.target?.noun ?? 'file'}`;
    return (
      <ActionSheet
        open={removal.asking}
        onClose={removal.cancel}
        label={action}
        caption={message}
        actions={[{ label: action, tone: 'danger', bold: true, onSelect: removal.confirm }]}
      />
    );
  }
  return removal.asking ? <InlineConfirm message={message} removal={removal} /> : null;
}

function InlineConfirm({ message, removal }: { message: string; removal: AttachmentRemoval }) {
  const ref = useRef<HTMLDivElement>(null);
  // The card moves focus to Cancel without scrolling, so one that opens out of view is shown.
  useEffect(() => {
    ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);
  // Escape cancels, as it closes the app's other confirms and sheets; it bubbles up from the
  // card's buttons, so the wrapper only listens and adds no meaning of its own. One something used
  // first, like one that dropped a file's viewer still on its way (PT-114), keeps the confirm.
  return (
    <div
      ref={ref}
      role="presentation"
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        removal.cancel();
      }}
    >
      <ConfirmCard
        message={message}
        confirmLabel="Remove"
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
      />
    </div>
  );
}
