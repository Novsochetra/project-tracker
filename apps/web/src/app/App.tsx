import { lazy, Suspense } from 'react';
import { TrackerApp } from './TrackerApp';

const Gallery = lazy(() => import('../dev/Gallery'));

export function App() {
  if (import.meta.env.DEV && window.location.pathname.startsWith('/__gallery')) {
    return (
      <Suspense fallback={null}>
        <Gallery />
      </Suspense>
    );
  }
  return <TrackerApp />;
}
