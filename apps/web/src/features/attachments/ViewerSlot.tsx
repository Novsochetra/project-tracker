import clsx from 'clsx';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { Spinner, useToast } from '../../components';
import { ErrorBoundary } from '../../lib/ErrorBoundary';
import './tokens.css';
import styles from './ViewerSlot.module.css';

interface Part {
  preload: () => Promise<unknown>;
  isLoaded: () => boolean;
}

export interface ViewerSlotProps {
  name: string;
  part: Part;
  // How often it was opened; until the first time its code isn't asked for.
  opens: number;
  open: boolean;
  failure: string;
  children: ReactNode;
}

// Quiet like a loading screen: a fast load shows nothing, a slow one a spinner after 400 ms. It
// takes no taps, so the screen stays usable meanwhile.
function ViewerOpening() {
  return (
    <div className={clsx(styles.opening, 'quiet-in')}>
      <span className={styles.badge}>
        <Spinner size={20} label="Opening" className={styles.spinner} />
      </span>
    </div>
  );
}

// The failed import stays failed until the page reloads, which the vite:preloadError rule does
// once it is safe; until then each open says it failed.
function ViewerFailed({ opens, message }: { opens: number; message: string }) {
  const toast = useToast();
  useEffect(() => {
    toast.show(message, { kind: 'error' });
  }, [opens, message, toast]);
  return null;
}

// Whether the part's code is in, or failed to load, so rendering it won't wait. Through a Suspense
// fallback instead, React holds the content back for 300 ms after the fallback showed: a delay
// on every fast load that just missed the press.
function useSettled(part: Part, wanted: boolean): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    const done = () => {
      if (live) setSettled(true);
    };
    part.preload().then(done, done);
    return () => {
      live = false;
    };
  }, [part, wanted]);
  return settled || part.isLoaded();
}

export function ViewerSlot({ name, part, opens, open, failure, children }: ViewerSlotProps) {
  const settled = useSettled(part, opens > 0);
  if (opens === 0) return null;
  if (!settled) return open ? <ViewerOpening /> : null;
  // A failed part suspends for a moment before it throws.
  return (
    <ErrorBoundary name={name} fallback={<ViewerFailed opens={opens} message={failure} />}>
      <Suspense fallback={null}>{children}</Suspense>
    </ErrorBoundary>
  );
}
