import type { TicketSearchHit } from '@tracker/shared';

export function searchHit(key: string, overrides: Partial<TicketSearchHit> = {}): TicketSearchHit {
  const [projectKey = 'MOB', num = '1'] = key.split('-');

  return {
    key,
    projectId: `p-${projectKey.toLowerCase()}`,
    projectKey,
    num: Number(num),
    title: `Ticket ${key}`,
    statusId: 's-todo',
    statusName: 'To do',
    statusCategory: 'todo',
    statusColor: '#8A8F98',
    match: 'title',
    snippet: null,
    updatedAt: 1,
    ...overrides,
  };
}
