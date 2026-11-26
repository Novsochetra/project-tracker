export type SheetRequest =
  | { type: 'newProject' }
  | { type: 'editProject'; projectKey: string }
  | { type: 'newTicket'; projectKey: string; statusId?: string }
  | { type: 'capture' }
  | { type: 'statuses'; projectKey: string }
  | { type: 'labels'; projectKey: string }
  | { type: 'connect' }
  | { type: 'account' }
  | { type: 'search' };

export interface SheetProps {
  open: boolean;
  onClose: () => void;
}
