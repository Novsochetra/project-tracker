import type { LabelRow } from '../db/labelTables';
import type { Db } from '../db/schema';
import { invalidInput } from '../errors';
import { listLabelRows } from '../repositories/labels';
import { labelIdsOfTicket } from '../repositories/ticketLabels';
import { eventEntry, type ActivityEntry } from './ticketWrites';

export interface LabelChange {
  labelIds: string[];
  entry: ActivityEntry;
}

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((id) => b.includes(id));

// In the project's order, so the ticket keeps them that way whatever order they were sent in.
export async function chosenLabels(
  db: Db,
  projectId: string,
  wanted: readonly string[],
): Promise<LabelRow[]> {
  const labels = await listLabelRows(db, projectId);
  const known = new Set(labels.map((label) => label.id));
  if (!wanted.every((id) => known.has(id))) throw invalidInput('Choose labels of this project.');
  return labels.filter((label) => wanted.includes(label.id));
}

export async function labelChange(
  db: Db,
  ticket: { id: string; projectId: string },
  wanted: readonly string[] | undefined,
): Promise<LabelChange | null> {
  if (wanted === undefined) return null;
  const labels = await chosenLabels(db, ticket.projectId, wanted);
  const labelIds = labels.map((label) => label.id);
  if (sameSet(labelIds, await labelIdsOfTicket(db, ticket.id))) return null;
  const names = labels.map((label) => label.name).join(', ');
  return { labelIds, entry: eventEntry(names ? `set labels to ${names}` : 'removed the labels') };
}
