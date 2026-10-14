import { errorMessage } from '../../../api';
import { useEditQueued, useRemoveQueued, useSendQueuedNow } from '../../../api/hooks/chatQueue';
import { useToast } from '../../../components';

export interface QueuedActions {
  edit: (text: string, onSaved: () => void) => void;
  remove: () => void;
  sendNow: () => void;
  busy: boolean;
}

export function useQueuedActions(chatId: string, messageId: string): QueuedActions {
  const edits = useEditQueued();
  const removes = useRemoveQueued();
  const sends = useSendQueuedNow();
  const toast = useToast();
  const onError = (error: Error) => toast.show(errorMessage(error), { kind: 'error' });
  const ref = { chatId, messageId };
  return {
    edit: (text, onSaved) => edits.mutate({ ...ref, text }, { onSuccess: onSaved, onError }),
    remove: () => removes.mutate(ref, { onError }),
    sendNow: () => sends.mutate(ref, { onError }),
    busy: edits.isPending || removes.isPending || sends.isPending,
  };
}
