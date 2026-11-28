import type { Label } from '@tracker/shared';
import { useRef } from 'react';
import { LabelMenu } from '../../src/features/labels/LabelMenu';

// The Labels row of New ticket, in its sheet, with the picker open (labelMenuLayout.ts lays it out).
export function NewTicketLabels({ labels }: { labels: Label[] }) {
  const anchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div role="dialog" aria-label="New ticket" data-testid="sheet">
      <button ref={anchorRef} type="button" data-testid="row">
        Labels
      </button>
      <LabelMenu
        open
        anchorRef={anchorRef}
        projectKey="MOB"
        labels={labels}
        value={[]}
        onChange={() => undefined}
        onClose={() => undefined}
      />
    </div>
  );
}
