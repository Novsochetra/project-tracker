import { useAnnouncement } from './announce';

export function LiveRegion() {
  const text = useAnnouncement();
  return (
    <div role="status" aria-live="polite" className="visually-hidden">
      {text}
    </div>
  );
}
