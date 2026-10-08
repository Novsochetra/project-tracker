import { lazy, Suspense } from 'react';
import { TrackerApp } from './TrackerApp';

// Only the dev server has it, so a production build doesn't carry or precache its code.
const Gallery = import.meta.env.DEV ? lazy(() => import('../dev/Gallery')) : null;

export function App() {
  if (Gallery && window.location.pathname.startsWith('/__gallery')) {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    );
  }
  return <TrackerApp />;
}
