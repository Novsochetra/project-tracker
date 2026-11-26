import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { busyKeys } from './pending';

function startPending(queryClient: QueryClient, variables: unknown): void {
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationFn: () => new Promise<never>(() => undefined),
  });
  void mutation.execute(variables);
}

const sorted = (keys: ReadonlySet<string>) => [...keys].sort();

describe('busyKeys', () => {
  it('keeps every ticket of a move of many busy, and their projects', () => {
    const queryClient = new QueryClient();
    startPending(queryClient, { ticketKeys: ['mob-3', 'WEB-1', 'MOB-4', 7] });
    startPending(queryClient, { ticketKey: 'MOB-9', input: {} });

    const busy = busyKeys(queryClient);
    expect(sorted(busy.ticketKeys)).toEqual(['MOB-3', 'MOB-4', 'MOB-9', 'WEB-1']);
    expect(sorted(busy.projectKeys)).toEqual(['MOB', 'WEB']);
  });

  it('leaves out the move that is settling', () => {
    const queryClient = new QueryClient();
    const settling = { ticketKeys: ['MOB-3', 'WEB-1'] };
    startPending(queryClient, settling);
    startPending(queryClient, { ticketKeys: ['MOB-4'] });

    const busy = busyKeys(queryClient, settling);
    expect(sorted(busy.ticketKeys)).toEqual(['MOB-4']);
    expect(sorted(busy.projectKeys)).toEqual(['MOB']);
  });
});
