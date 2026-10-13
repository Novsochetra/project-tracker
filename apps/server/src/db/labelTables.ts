export interface LabelRow {
  id: string;
  projectId: string;
  name: string;
  color: string;
  template: string;
  instructions: string;
  position: number;
  createdAt: number;
}

export interface TicketLabelRow {
  id: string;
  ticketId: string;
  labelId: string;
  createdAt: number;
}

export interface LabelTables {
  labels: LabelRow;
  ticketLabels: TicketLabelRow;
}
