import { byRank, evenRanks, type Rankable } from './rank';

export interface Placeable extends Rankable {
  statusId: string;
}

export interface DropTarget {
  statusId: string;
  beforeId?: string | null;
  afterId?: string | null;
}

export interface MovePlan {
  statusChanged: boolean;
  ranks: Map<string, number>;
}

const sortedGroup = <T extends Placeable>(
  tickets: readonly T[],
  statusId: string,
  skipId?: string,
) => tickets.filter((t) => t.statusId === statusId && t.id !== skipId).sort(byRank);

function insertionIndex(group: readonly Placeable[], target: DropTarget): number {
  if (target.beforeId) {
    const index = group.findIndex((t) => t.id === target.beforeId);
    return index < 0 ? group.length : index;
  }
  if (target.afterId) {
    const index = group.findIndex((t) => t.id === target.afterId);
    return index < 0 ? group.length : index + 1;
  }
  return group.length;
}

export function planMove(
  tickets: readonly Placeable[],
  ticketId: string,
  target: DropTarget,
): MovePlan | null {
  const moved = tickets.find((t) => t.id === ticketId);
  if (!moved) return null;
  const group = sortedGroup(tickets, target.statusId, ticketId);
  const index = insertionIndex(group, target);
  const order = [...group.slice(0, index), moved, ...group.slice(index)].map((t) => t.id);
  const statusChanged = moved.statusId !== target.statusId;
  if (!statusChanged) {
    const current = sortedGroup(tickets, moved.statusId).map((t) => t.id);
    if (current.join() === order.join()) return null;
  }
  return { statusChanged, ranks: evenRanks(order) };
}

export type MoveDirection = 'up' | 'down';

function moveWithinGroup(
  own: readonly Placeable[],
  index: number,
  direction: MoveDirection,
): DropTarget | null {
  const statusId = own[index]?.statusId;
  if (!statusId) return null;
  if (direction === 'up') {
    return index > 0 ? { statusId, beforeId: own[index - 1]?.id ?? null } : null;
  }
  if (index >= own.length - 1) return null;
  return { statusId, beforeId: own[index + 2]?.id ?? null, afterId: own[index + 1]?.id ?? null };
}

function moveAcrossGroups(
  tickets: readonly Placeable[],
  ticket: Placeable,
  direction: MoveDirection,
  statusOrder: readonly string[],
): DropTarget | null {
  const statusIndex = statusOrder.indexOf(ticket.statusId);
  if (statusIndex < 0) return null;
  const neighbor = statusOrder[direction === 'up' ? statusIndex - 1 : statusIndex + 1];
  if (!neighbor) return null;
  const group = sortedGroup(tickets, neighbor, ticket.id);
  if (direction === 'up')
    return { statusId: neighbor, beforeId: null, afterId: group.at(-1)?.id ?? null };
  return { statusId: neighbor, beforeId: group[0]?.id ?? null, afterId: null };
}

export function keyboardMoveTarget(
  tickets: readonly Placeable[],
  ticketId: string,
  direction: MoveDirection,
  statusOrder: readonly string[],
): DropTarget | null {
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) return null;
  const own = sortedGroup(tickets, ticket.statusId);
  const index = own.findIndex((t) => t.id === ticketId);
  return (
    moveWithinGroup(own, index, direction) ??
    moveAcrossGroups(tickets, ticket, direction, statusOrder)
  );
}
