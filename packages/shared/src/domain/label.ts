// Plain numbers as well as in the API's schemas, so the web app reads them without loading zod.
export const LABEL_NAME_MAX = 40;
export const LABEL_TEMPLATE_MAX = 20_000;
export const LABEL_INSTRUCTIONS_MAX = 20_000;

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string;
  // Fills an empty description when a person picks the label for a new ticket.
  template: string;
  // For Claude, after the project's instructions, on every ticket with the label.
  instructions: string;
  position: number;
  createdAt: number;
}
