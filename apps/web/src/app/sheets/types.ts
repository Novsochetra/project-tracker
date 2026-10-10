export type PromptScope =
  { kind: 'ticket'; ticketKey: string } | { kind: 'project'; projectKey: string };

export type ReportScope =
  | { kind: 'ticket'; ticketKey: string; projectKey: string }
  | { kind: 'project'; projectKey: string };

export type SheetRequest =
  | { type: 'newProject' }
  | { type: 'editProject'; projectKey: string }
  | { type: 'newTicket'; projectKey: string; statusId?: string }
  | { type: 'capture' }
  | { type: 'prompt'; scope: PromptScope }
  | { type: 'report'; scope: ReportScope }
  | { type: 'statuses'; projectKey: string }
  | { type: 'runSteps'; runId: string; ticketKey: string }
  | { type: 'connect' }
  | { type: 'account' };

export interface SheetProps {
  open: boolean;
  onClose: () => void;
}
