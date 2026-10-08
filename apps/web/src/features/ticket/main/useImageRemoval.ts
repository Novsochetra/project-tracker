import { useRef, useState } from 'react';
import { errorMessage, useDeleteAttachment } from '../../../api';
import { useToast } from '../../../components';

export interface ImageRemovalTarget {
  id: string;
  number: number;
}

export interface ImageRemoval {
  /** The image last asked about, kept while the phone sheet animates out. */
  target: ImageRemovalTarget | null;
  asking: boolean;
  ask: (id: string, index: number) => void;
  cancel: () => void;
  confirm: () => void;
}

/** Removing a saved ticket image asks first, like every other delete. */
export function useImageRemoval(ticketKey: string): ImageRemoval {
  const [target, setTarget] = useState<ImageRemovalTarget | null>(null);
  const [asking, setAsking] = useState(false);
  const askedFromRef = useRef<HTMLElement | null>(null);
  const removeAttachment = useDeleteAttachment();
  const { show } = useToast();
  return {
    target,
    asking,
    ask: (id, index) => {
      const focused = document.activeElement;
      askedFromRef.current = focused instanceof HTMLElement ? focused : null;
      setTarget({ id, number: index + 1 });
      setAsking(true);
    },
    cancel: () => {
      setAsking(false);
      // The confirm took focus from the x, so give it back when nothing is removed.
      askedFromRef.current?.focus({ preventScroll: true });
    },
    confirm: () => {
      setAsking(false);
      if (!target) return;
      void removeAttachment
        .mutateAsync({ attachmentId: target.id, ticketKey })
        .catch((error: unknown) => show(errorMessage(error)));
    },
  };
}
