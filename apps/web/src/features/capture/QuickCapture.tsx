import { useCallback } from 'react';
import type { Reachability } from '../../app/reachability';
import { useSheets } from '../../app/sheets/context';
import { useCaptureSync } from './useCaptureSync';
import { useCaptureLink, useCaptureShortcut } from './useCaptureTriggers';

export function QuickCapture({ reachability }: { reachability: Reachability }) {
  const { open, current } = useSheets();
  const openCapture = useCallback(() => open({ type: 'capture' }), [open]);
  useCaptureSync(reachability);
  useCaptureShortcut(openCapture, current === null);
  useCaptureLink(openCapture);
  return null;
}
