import { useCallback, useState } from 'react';

export interface Presence {
  mounted: boolean;
  onExited: () => void;
}

export function usePresence(open: boolean): Presence {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const onExited = useCallback(() => setMounted(false), [setMounted]);
  return { mounted, onExited };
}
