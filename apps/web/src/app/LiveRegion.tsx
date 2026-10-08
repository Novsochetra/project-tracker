import { useAnnouncement } from './announce';

export function LiveRegion() {
  const { id, text } = useAnnouncement();
  return (
    <div role="status" aria-live="polite" className="visually-hidden">
      {text ? <div key={id}>{text}</div> : null}
    </div>
  );
}
