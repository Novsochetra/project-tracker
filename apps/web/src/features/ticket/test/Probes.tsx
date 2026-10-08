import { useLocation } from 'react-router';
import { useSheets } from '../../../app/sheets/context';

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
