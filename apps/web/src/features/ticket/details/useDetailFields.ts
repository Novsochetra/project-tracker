import { isDoneCategory, isOverdue, type Priority, type TicketDetail } from '@tracker/shared';
import type { DeviceChoice } from '../side/detailOptions';
import { useFieldDraft, type FieldDraftState } from '../fields/useFieldDraft';
import { useStatusMove } from '../useStatusMove';
import { useTicketUpdate } from '../useTicketUpdate';

export interface DetailFields {
  assignee: FieldDraftState;
  overdue: boolean;
  setStatus: (statusId: string) => void;
  setPriority: (priority: Priority) => void;
  setDue: (due: string) => void;
  setDevice: (choice: DeviceChoice) => void;
}

// Status, Priority, Assignee and Due date, for the desktop Details card and the phone chips.
export function useDetailFields(detail: TicketDetail): DetailFields {
  const { ticket } = detail;
  const update = useTicketUpdate(ticket.key);
  const moveTo = useStatusMove(detail);
  const assignee = useFieldDraft(ticket.assignee, { ticketKey: ticket.key, field: 'assignee' });
  return {
    assignee,
    overdue: isOverdue(ticket.due, isDoneCategory(detail.status.category)),
    setStatus: (statusId) => {
      const status = detail.statuses.find((candidate) => candidate.id === statusId);
      if (status) moveTo(status);
    },
    setPriority: (priority) => {
      if (priority !== ticket.priority) void update({ priority });
    },
    setDue: (due) => {
      if (due !== ticket.due) void update({ due });
    },
    setDevice: (choice) => {
      if ((choice === 'yes') !== ticket.needsDevice) void update({ needsDevice: choice === 'yes' });
    },
  };
}
