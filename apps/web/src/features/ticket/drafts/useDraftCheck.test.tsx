import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../../api';
import { deferred } from '../../../api/test/deferred';
import { listItem, makeTicketDetail, STATUS } from '../../../api/test/fixtures';
import { cachedTicket, seedTicket, setupApi } from '../../../api/test/render';
import { keepDraft, storedDraft } from '../../../lib/storedDrafts';
import { useDraftCheck } from './useDraftCheck';

const ID = 'description:MOB-1';
const theirs = makeTicketDetail(listItem(1, STATUS.todo, 0, { description: 'Theirs' }));

function setup(getTicket = vi.fn().mockResolvedValue(theirs)) {
  const api = setupApi({ getTicket });
  seedTicket(api.queryClient);
  const { result } = renderHook(() => useDraftCheck('MOB-1'), { wrapper: api.wrapper });
  return { ...api, check: result.current };
}

beforeEach(() => {
  localStorage.clear();
  keepDraft(ID, { ticketKey: 'MOB-1', field: 'description', text: 'Mine' }, '');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDraftCheck', () => {
  it('reads the ticket fresh and shows what it found', async () => {
    const { check, client, queryClient } = setup();
    expect(await check(ID)).toBe('changed');
    expect(client.getTicket).toHaveBeenCalledWith('MOB-1', { fresh: true });
    expect(cachedTicket(queryClient).ticket.description).toBe('Theirs');
  });

  it('leaves the screen to a save that started during the read, which is newer', async () => {
    const read = deferred<typeof theirs>();
    const { check, queryClient } = setup(vi.fn().mockReturnValue(read.promise));
    const checking = check(ID);
    const save = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => new Promise(() => undefined),
    });
    void save.execute({ ticketKey: 'MOB-1', input: { title: 'Saving' } });
    queryClient.setQueryData(queryKeys.ticket('MOB-1'), makeTicketDetail());
    read.resolve(theirs);
    expect(await checking).toBe('changed');
    expect(cachedTicket(queryClient).ticket.description).toBe('');
  });

  // Another tab's save of 'Theirs' just landed, and the base it keeps in step hasn't reached this
  // tab yet; the field typed 'Mine' over 'Theirs'.
  it('counts text the field says it typed over as unchanged, and makes it the base', async () => {
    const { check } = setup();
    expect(await check(ID, 'Theirs')).toBe('unchanged');
    expect(storedDraft(ID)?.base).toBe('Theirs');
    expect(await check(ID, 'Something else')).toBe('unchanged');
  });

  it('says the tracker cannot be reached when the read fails, and keeps the cache', async () => {
    const { check, queryClient } = setup(vi.fn().mockRejectedValue(new TypeError('Failed')));
    expect(await check(ID)).toBe('unreachable');
    expect(cachedTicket(queryClient).ticket.description).toBe('');
  });
});
