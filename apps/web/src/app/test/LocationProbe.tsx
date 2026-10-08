import { useLocation } from 'react-router';

export function LocationProbe() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}
