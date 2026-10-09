import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject } from './helpers';

const titleOf = (page: Page) => page.getByLabel('Title', { exact: true });
const note = (page: Page) => page.getByText(/isn't saved yet|changed elsewhere/);

async function open(context: BrowserContext, existing?: Page): Promise<Page> {
  const page = existing ?? (await context.newPage());
  await page.goto('/p/MOB/1');
  await expect(titleOf(page)).toHaveValue('Ticket 1');
  return page;
}

async function typeAtEnd(page: Page, text: string): Promise<void> {
  const title = titleOf(page);
  // Not a click: on a loaded machine the layout can still shift under it, and the keys go nowhere.
  await title.focus();
  await title.evaluate((field: HTMLTextAreaElement) =>
    field.setSelectionRange(field.value.length, field.value.length),
  );
  await page.keyboard.type(text, { delay: 20 });
  await title.blur();
}

// Holds the page's saves of the ticket until released, as a connection that stalls would.
async function holdSaves(page: Page): Promise<() => void> {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === '/api/tickets/MOB-1',
    async (route) => {
      if (route.request().method() === 'PATCH') await held;
      await route.continue().catch(() => undefined);
    },
  );
  return release;
}

// Reviewer 61 (PT-76): tab A's save hung, tab B typed on top of A's text and saved, and when A's
// older save landed it overwrote B's text.
test('an older save that lands late does not overwrite newer text from another tab', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  const a = await open(context, page);
  const b = await open(context);
  const release = await holdSaves(a);

  await typeAtEnd(a, ' from A');
  await expect(titleOf(b)).toHaveValue('Ticket 1 from A');
  // No note: B knows A is sending it.
  await expect(note(b)).toHaveCount(0);
  await typeAtEnd(b, ' and B');

  // B's text was typed over A's, which the tracker doesn't have yet: it waits for A's save.
  release();
  await expect
    .poll(async () => (await api.getTicket('MOB-1')).ticket.title)
    .toBe('Ticket 1 from A and B');
  await expect(titleOf(a)).toHaveValue('Ticket 1 from A and B');
  await expect(note(a)).toHaveCount(0);
  await expect(titleOf(b)).toHaveValue('Ticket 1 from A and B');
  await expect(note(b)).toHaveCount(0);
});

// The same with an edit back to the older value: B clears the name A is still sending, so B's
// save would change nothing, and A's save would put the name back when it lands.
test('a name cleared in another tab while its save hangs stays cleared', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  const a = await open(context, page);
  const b = await open(context);
  const release = await holdSaves(a);
  const assignee = (tab: Page) => tab.getByLabel('Assignee', { exact: true });

  await assignee(a).fill('Dara');
  await assignee(a).blur();
  await expect(assignee(b)).toHaveValue('Dara');
  await expect(note(b)).toHaveCount(0);
  await assignee(b).fill('');
  await assignee(b).blur();

  release();
  await expect(assignee(a)).toHaveValue('');
  await expect(assignee(b)).toHaveValue('');
  await expect.poll(async () => (await api.getTicket('MOB-1')).ticket.assignee).toBe('');
  await expect(note(b)).toHaveCount(0);
});
