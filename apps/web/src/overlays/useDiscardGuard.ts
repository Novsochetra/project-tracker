import { useState } from 'react';

export interface DiscardGuard {
  asking: boolean;
  requestClose: () => void;
  keepEditing: () => void;
  discard: () => void;
}

export function useDiscardGuard(open: boolean, dirty: boolean, onClose: () => void): DiscardGuard {
  const [asking, setAsking] = useState(false);
  // The owner can close the sheet while the question is up (a save landed); reopening must not
  // show the question again.
  if (asking && !open) setAsking(false);
  return {
    asking,
    requestClose: () => {
      if (dirty) setAsking(true);
      else onClose();
    },
    keepEditing: () => setAsking(false),
    discard: () => {
      setAsking(false);
      onClose();
    },
  };
}
