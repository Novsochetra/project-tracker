import { Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage, useDeleteTicket } from '../../../api';
import { Button, ConfirmCard, useToast } from '../../../components';
import { forgetTicketDrafts } from '../../../lib/storedDrafts';
import { useNavigation } from '../../../navigation';
import styles from './SidePanel.module.css';

type Phase = 'idle' | 'confirming' | 'cancelled';

export function DeleteTicket({ ticketKey }: { ticketKey: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const deleteTicket = useDeleteTicket();
  const { back } = useNavigation();
  const { show } = useToast();

  // The confirm card took focus from this button, so give it back when the delete is cancelled.
  useEffect(() => {
    if (phase === 'cancelled') triggerRef.current?.focus({ preventScroll: true });
  }, [phase]);

  if (phase !== 'confirming') {
    return (
      <Button
        ref={triggerRef}
        variant="text"
        tone="danger"
        icon={Trash2}
        className={styles.delete}
        onClick={() => setPhase('confirming')}
      >
        Delete ticket
      </Button>
    );
  }
  const confirm = () => {
    void deleteTicket.mutateAsync({ ticketKey }).then(
      () => {
        // Unsaved text in a deleted ticket has nothing left to save into.
        forgetTicketDrafts(ticketKey);
        back();
        show(`${ticketKey} deleted`);
      },
      (error: unknown) => show(errorMessage(error)),
    );
  };
  return (
    <ConfirmCard
      message={`Delete ${ticketKey}? This can't be undone.`}
      pending={deleteTicket.isPending}
      onCancel={() => setPhase('cancelled')}
      onConfirm={confirm}
    />
  );
}
