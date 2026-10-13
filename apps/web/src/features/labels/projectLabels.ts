import { labelsOf, type Label, type Ticket } from '@tracker/shared';
import { createContext, useContext } from 'react';

export const ProjectLabelsContext = createContext<readonly Label[]>([]);

export const useTicketLabels = (ticket: Pick<Ticket, 'labelIds'>): Label[] =>
  labelsOf(useContext(ProjectLabelsContext), ticket.labelIds);
