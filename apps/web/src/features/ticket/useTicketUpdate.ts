import type { UpdateTicketInput } from '@tracker/shared';
import { errorMessage, useUpdateTicket } from '../../api';
import { useToast } from '../../components';

export function useTicketUpdate(ticketKey: string): (input: UpdateTicketInput) => Promise<boolean> {
  const update = useUpdateTicket();
  const { show } = useToast();
  return (input) =>
    // mutateAsync, because callbacks passed to mutate only run for the latest call.
    update.mutateAsync({ ticketKey, input }).then(
      () => true,
      (error: unknown) => {
        show(errorMessage(error), { kind: 'error' });
        return false;
      },
    );
}
