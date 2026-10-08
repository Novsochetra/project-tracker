import type { UpdateTicketInput } from '@tracker/shared';
import { errorMessage, useUpdateTicket } from '../../api';
import { useToast } from '../../components';

export function useTicketUpdate(ticketKey: string): (input: UpdateTicketInput) => void {
  const update = useUpdateTicket();
  const { show } = useToast();
  return (input) => {
    // mutateAsync, because callbacks passed to mutate only run for the latest call.
    void update
      .mutateAsync({ ticketKey, input })
      .catch((error: unknown) => show(errorMessage(error)));
  };
}
