export interface ChangeEvent {
  type: 'changed';
  projectId: string | null;
  ticketId: string | null;
}
