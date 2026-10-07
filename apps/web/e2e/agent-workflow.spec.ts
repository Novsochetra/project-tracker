import { expect, test } from './fixtures';
import { activity, group, pickFromListbox, seedProject, ticketRow } from './helpers';

test.describe('agent workflow', () => {
  test('worker and reviewer agents move a ticket while the page is open', async ({
    page,
    api,
    agent,
  }) => {
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Cache avatars', description: 'Cache them on disk for a week.' },
    ]);
    await page.goto('/p/MOB');
    await expect(group(page, 'To do')).toContainText('Cache avatars');

    const claimed = await agent.claimNext('MOB');
    expect(claimed?.ticket.key).toBe('MOB-1');
    await expect(group(page, 'In progress')).toContainText('Cache avatars');

    await agent.addComment('MOB-1', { text: 'Using the existing image cache.' });
    await agent.submitForReview('MOB-1', {
      summary: 'Avatars are cached for 7 days.',
      files: 'src/avatar.ts',
    });
    await expect(group(page, 'Need review')).toContainText('Cache avatars');

    await agent.reviewTicket('MOB-1', {
      verdict: 'approved',
      rating: 4,
      summary: 'Works; tests cover expiry.',
    });
    await expect(group(page, 'Reviewed')).toContainText('Cache avatars');

    await ticketRow(page, 'MOB-1').click();
    const log = activity(page);
    await expect(log).toContainText('Claude picked up the ticket and moved it to In progress');
    await expect(log).toContainText('Using the existing image cache.');
    await expect(log).toContainText('Avatars are cached for 7 days.');
    await expect(log).toContainText('Works; tests cover expiry.');
    await expect(log.getByLabel('Rated 4 out of 5')).toBeVisible();

    await pickFromListbox(page, 'Status', 'Done');
    await expect(log).toContainText('You changed status to Done');
  });

  test('agents cannot move tickets to Done', async ({ api, agent }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Anything' }]);
    const { statuses } = await api.getProject('MOB');
    const done = statuses.find((status) => status.category === 'done');
    await expect(agent.updateTicket('MOB-1', { statusId: done?.id })).rejects.toMatchObject({
      status: 403,
    });
  });
});
