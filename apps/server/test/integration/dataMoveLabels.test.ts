import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { createBroadcaster } from '../../src/events/broadcaster';
import { moveData, openMoveTarget, writeMoveSource } from '../helpers/dataMove';
import { clientFor, DIALECTS } from '../helpers/server';

// Labels are project data, so the move copies them with the tickets that have them (PT-190).
describe.each(DIALECTS)('moving a tracker with labels into %s', (dialect) => {
  it('copies the labels and which tickets have them', async () => {
    const source = await writeMoveSource('0023_labels');
    const target = await openMoveTarget(dialect, null);
    const { ok, lines } = await moveData(source, target);

    expect(ok).toBe(true);
    expect(lines).toEqual(expect.arrayContaining(['  labels         1', '  ticket_labels  1']));
    const client = clientFor(
      createApp({ db: target.db, storage: target.storage, events: createBroadcaster() }),
    );
    const detail = await client.getTicket('MOB-1');
    expect(detail.ticket.labelIds).toEqual(['l-bug']);
    expect(detail.labels).toEqual([
      expect.objectContaining({
        id: 'l-bug',
        name: 'Bug',
        template: '## Steps',
        instructions: 'Reproduce it first.',
      }),
    ]);
  });
});
