import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject } from './helpers';
import { holdSaves, note, open, titleOf, typeAtEnd } from './twoTabs';

// Reviewer 61 (PT-76): tab A's save hung, tab B typed on top of A's text and saved, and when A's
// older save landed it overwrote B's text.
test('an older save that lands late does not overwrite newer text from another tab', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  const tabA = await open(context, page);
  const tabB = await open(context);
  const release = await holdSaves(tabA);

  await typeAtEnd(tabA, ' from A');
  await expect(titleOf(tabB)).toHaveValue('Ticket 1 from A');
  // No note: B knows A is sending it.
  await expect(note(tabB)).toHaveCount(0);
  await typeAtEnd(tabB, ' and B');

  // B's text was typed over A's, which the tracker doesn't have yet: it waits for A's save.
  release();
  await expect
    .poll(async () => (await api.getTicket('MOB-1')).ticket.title)
    .toBe('Ticket 1 from A and B');
  await expect(titleOf(tabA)).toHaveValue('Ticket 1 from A and B');
  await expect(note(tabA)).toHaveCount(0);
  await expect(titleOf(tabB)).toHaveValue('Ticket 1 from A and B');
  await expect(note(tabB)).toHaveCount(0);
});

// The same with an edit back to the older value: B clears the name A is still sending, so B's
// save would change nothing, and A's save would put the name back when it lands.
test('a name cleared in another tab while its save hangs stays cleared', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  const tabA = await open(context, page);
  const tabB = await open(context);
  const release = await holdSaves(tabA);
  const assignee = (tab: Page) => tab.getByLabel('Assignee', { exact: true });

  await assignee(tabA).fill('Dara');
  await assignee(tabA).blur();
  await expect(assignee(tabB)).toHaveValue('Dara');
  await expect(note(tabB)).toHaveCount(0);
  await assignee(tabB).fill('');
  await assignee(tabB).blur();

  release();
  await expect(assignee(tabA)).toHaveValue('');
  await expect(assignee(tabB)).toHaveValue('');
  await expect.poll(async () => (await api.getTicket('MOB-1')).ticket.assignee).toBe('');
  await expect(note(tabB)).toHaveCount(0);
});
