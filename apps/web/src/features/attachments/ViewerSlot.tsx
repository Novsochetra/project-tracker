import { Suspense, useEffect, type ReactNode } from 'react';
import { useToast } from '../../components';
import { ErrorBoundary } from '../../lib/ErrorBoundary';

export interface ViewerSlotProps {
  name: string;
  // Whether the viewers' code is in or failed to load (useViewersSettled).
  settled: boolean;
  // How often it was opened; until the first time its code isn't asked for.
  opens: number;
  open: boolean;
  failure: string;
  children: ReactNode;
}

// The failed import stays failed until the page reloads, which the vite:preloadError rule does
// once it is safe; until then each open says it failed. An open dropped before the code failed
// says nothing: the person had moved on.
function ViewerFailed({ opens, open, message }: { opens: number; open: boolean; message: string }) {
  const toast = useToast();
  useEffect(() => {
    if (open) toast.show(message, { kind: 'error' });
  }, [opens, open, message, toast]);
  return null;
}

// Renders the viewer once its code is in or failed; meanwhile the tapped tile shows the spinner
// (OpeningMark).
export function ViewerSlot({ name, settled, opens, open, failure, children }: ViewerSlotProps) {
  if (opens === 0 || !settled) return null;
  // A failed part suspends for a moment before it throws.
  return (
    <ErrorBoundary
      name={name}
      fallback={<ViewerFailed opens={opens} open={open} message={failure} />}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </ErrorBoundary>
  );
}
