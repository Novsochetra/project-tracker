import { labelsOf, type Label, type Ticket } from '@tracker/shared';
import { createContext, useContext } from 'react';

// The project's labels, for the rows and cards that show a ticket's own by id.
export const ProjectLabelsContext = createContext<readonly Label[]>([]);

export const useTicketLabels = (ticket: Pick<Ticket, 'labelIds'>): Label[] =>
  labelsOf(useContext(ProjectLabelsContext), ticket.labelIds);
