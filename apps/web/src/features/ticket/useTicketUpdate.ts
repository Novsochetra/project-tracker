import type { UpdateTicketInput } from '@tracker/shared';
import { errorMessage, useUpdateTicket } from '../../api';
import { useToast } from '../../components';

/** Saves ticket fields and resolves to whether they were saved; failures are explained in a toast. */
export function useTicketUpdate(ticketKey: string): (input: UpdateTicketInput) => Promise<boolean> {
  const update = useUpdateTicket();
  const { show } = useToast();
  return (input) =>
    // mutateAsync, because callbacks passed to mutate only run for the latest call.
    update.mutateAsync({ ticketKey, input }).then(
      () => true,
      (error: unknown) => {
        show(errorMessage(error));
        return false;
      },
    );
}
