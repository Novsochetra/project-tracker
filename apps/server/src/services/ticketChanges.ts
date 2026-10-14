import { PRIORITY_LABELS, formatShortDay, type Priority } from '@tracker/shared';
import type { TicketRow } from '../db/schema';
import type { TicketChanges } from '../repositories/tickets';
import { eventEntry, type ActivityEntry } from './ticketWrites';

export interface FieldInput {
  title?: string;
  description?: string;
  priority?: Priority;
  assignee?: string;
  due?: string;
  needsDevice?: boolean;
}

export interface PlannedChange {
  changes: TicketChanges;
  entries: ActivityEntry[];
}

const NO_CHANGE: PlannedChange = { changes: {}, entries: [] };

const differs = <T>(next: T | undefined, current: T): next is T =>
  next !== undefined && next !== current;

function priorityChange(ticket: TicketRow, priority: Priority | undefined): PlannedChange {
  if (!differs(priority, ticket.priority)) return NO_CHANGE;
  return {
    changes: { priority },
    entries: [eventEntry(`set priority to ${PRIORITY_LABELS[priority]}`)],
  };
}

function assigneeChange(ticket: TicketRow, raw: string | undefined): PlannedChange {
  const assignee = raw?.trim();
  if (!differs(assignee, ticket.assignee)) return NO_CHANGE;
  const text = assignee ? `assigned the ticket to ${assignee}` : 'removed the assignee';
  return { changes: { assignee }, entries: [eventEntry(text)] };
}

function dueChange(ticket: TicketRow, due: string | undefined, today: Date): PlannedChange {
  if (!differs(due, ticket.due)) return NO_CHANGE;
  const text = due ? `set the due date to ${formatShortDay(due, today)}` : 'removed the due date';
  return { changes: { due }, entries: [eventEntry(text)] };
}

function deviceChange(ticket: TicketRow, needsDevice: boolean | undefined): PlannedChange {
  const next = needsDevice === undefined ? undefined : Number(needsDevice);
  if (!differs(next, ticket.needsDevice)) return NO_CHANGE;
  const text = needsDevice ? 'marked the ticket as needing a device' : 'cleared the device mark';
  return { changes: { needsDevice: next }, entries: [eventEntry(text)] };
}

function textChanges(ticket: TicketRow, input: FieldInput): TicketChanges {
  const changes: TicketChanges = {};
  if (differs(input.title, ticket.title)) changes.title = input.title;
  if (differs(input.description, ticket.description)) changes.description = input.description;
  return changes;
}

export function mergeChanges(parts: readonly PlannedChange[]): PlannedChange {
  return {
    changes: Object.assign({}, ...parts.map((part) => part.changes)) as TicketChanges,
    entries: parts.flatMap((part) => part.entries),
  };
}

export function fieldChanges(ticket: TicketRow, input: FieldInput, today: Date): PlannedChange {
  return mergeChanges([
    { changes: textChanges(ticket, input), entries: [] },
    priorityChange(ticket, input.priority),
    assigneeChange(ticket, input.assignee),
    dueChange(ticket, input.due, today),
    deviceChange(ticket, input.needsDevice),
  ]);
}
