import { isDoneCategory, type CreateTicketInput, type Status } from '@tracker/shared';
import { useRef } from 'react';
import { errorMessage, useCreateTicket } from '../../api';
import { flashRows } from '../../app/flash';
import { useToast } from '../../components';
import { getListView, hidesNewTicket, resetListView } from './listViewStore';

export interface CreateTicketFlow {
  projectKey: string;
  statuses: readonly Status[];
  onCreated: () => void;
  onError: (message: string) => void;
}

export function useCreateTicketFlow({
  projectKey,
  statuses,
  onCreated,
  onError,
}: CreateTicketFlow) {
  const { mutate, isPending } = useCreateTicket();
  const { show } = useToast();
  // isPending only updates on the next render; a second Enter can arrive before that.
  const submitting = useRef(false);
  const submit = (input: CreateTicketInput) => {
    if (submitting.current) return;
    submitting.current = true;
    mutate(
      { projectKey, input },
      {
        onSuccess: (ticket) => {
          const status = statuses.find((candidate) => candidate.id === ticket.statusId);
          const isDone = status ? isDoneCategory(status.category) : false;
          if (hidesNewTicket(getListView(projectKey), isDone)) resetListView(projectKey);
          flashRows([ticket.key]);
          show(`${ticket.key} created`);
          onCreated();
        },
        onError: (error) => onError(errorMessage(error)),
        onSettled: () => {
          submitting.current = false;
        },
      },
    );
  };
  return { submit, pending: isPending };
}
