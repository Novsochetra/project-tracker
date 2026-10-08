import { useLocation } from 'react-router';
import { useSheets } from '../../../app/sheets/context';

/** Shows the location and the requested sheet, so tests can read where an action led. */
export function Probes() {
  const { pathname } = useLocation();
  const sheet = useSheets().current;
  return (
    <>
      <output aria-label="Location">{pathname}</output>
      <output aria-label="Sheet">{sheet ? JSON.stringify(sheet) : ''}</output>
    </>
  );
}
