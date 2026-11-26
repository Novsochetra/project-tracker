import { useContext } from 'react';
import { SheetsContext } from '../../app/sheets/context';

export function useManageLabels(projectKey: string, close: () => void): (() => void) | undefined {
  const sheets = useContext(SheetsContext);
  if (!sheets) return undefined;
  // Opened in a later task, so the Labels sheet takes focus after the picker hands it back.
  return () => {
    close();
    window.setTimeout(() => sheets.open({ type: 'labels', projectKey }), 0);
  };
}
