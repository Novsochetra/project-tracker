import { projectUsageParts, type ProjectUsage } from '@tracker/shared';

const ticketCount = (count: number): string => `${count} ${count === 1 ? 'ticket' : 'tickets'}`;

const CANT_UNDO = "This can't be undone.";

export const deleteMenuMessage = (count: number): string =>
  `Delete this project and its ${ticketCount(count)}? ${CANT_UNDO}`;

export const deleteSheetCaption = (name: string, count: number): string =>
  `Delete “${name}” and its ${ticketCount(count)}? ${CANT_UNDO}`;

export const deletedToast = (name: string): string => `“${name}” deleted`;

export interface UsageNote {
  label: string;
  parts: string[];
}

export function projectUsageNote(usage: ProjectUsage | undefined): UsageNote | null {
  const parts = usage ? projectUsageParts(usage) : [];
  if (!usage || parts.length === 0) return null;
  return { label: `Claude Code, last ${usage.days} days:`, parts };
}
