import { sortStatuses, type Status } from '@tracker/shared';

interface WithStatuses {
  statuses: Status[];
}

export const withStatuses = <T extends WithStatuses>(
  data: T,
  update: (statuses: Status[]) => Status[],
): T => ({ ...data, statuses: update(data.statuses) });

export function reorderStatusList(statuses: readonly Status[], ids: readonly string[]): Status[] {
  const order = new Map(ids.map((id, index) => [id, index]));
  return sortStatuses(
    statuses.map((status) => ({
      ...status,
      position: order.get(status.id) ?? ids.length + status.position,
    })),
  );
}

export const upsertStatus = (statuses: readonly Status[], status: Status): Status[] =>
  sortStatuses([...statuses.filter((item) => item.id !== status.id), status]);
