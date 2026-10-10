import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activity, readActionSheet, seedProject } from './helpers';
import { hold, holdSaves, note, open, titleOf, typeAtEnd } from './twoTabs';

const box = (page: Page) => page.getByLabel('Comment', { exact: true });
const trackerTitle = async (api: {
  getTicket: (key: string) => Promise<{ ticket: { title: string } }>;
}) => (await api.getTicket('MOB-1')).ticket.title;

// A minute on: the tab's marks of its saves stop counting, as they do for a save hanging that long.
async function marksRunOut(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('tracker.draftSaves:')) continue;
      const mark = JSON.parse(localStorage.getItem(key) ?? '{}') as { until: number };
      localStorage.setItem(key, JSON.stringify({ ...mark, until: Date.now() + 300 }));
    }
  });
}

// Reviewer 77 (PT-90 follow-ups 1 and 6): A's save hung past a minute while B typed on top of it.
// B waited on A's mark with no end, and once B's text was saved, A's refused save kept A's older
// text again, which both tabs then showed as "changed elsewhere".
test('a save that hangs past a minute and lands after newer text leaves the newer text', async ({
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
  await typeAtEnd(b, ' and B');
  await expect(note(b)).toHaveText("Title isn't saved yet.");

  await marksRunOut(a);
  await expect.poll(() => trackerTitle(api)).toBe('Ticket 1 from A and B');
  await expect(note(b)).toHaveCount(0);

  release();
  await expect(titleOf(a)).toHaveValue('Ticket 1 from A and B');
  await expect(note(a)).toHaveCount(0);
  await expect(titleOf(b)).toHaveValue('Ticket 1 from A and B');
  await expect(note(b)).toHaveCount(0);
  expect(await trackerTitle(api)).toBe('Ticket 1 from A and B');
  await b.reload();
  await expect(titleOf(b)).toHaveValue('Ticket 1 from A and B');
  await expect(note(b)).toHaveCount(0);
});

// The records of B's text that A has heard of, as A's copy of storage holds them.
const recordsHeard = (page: Page): Promise<string[]> =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('tracker.drafts:')));

// Reviewer 77 (follow-up 2): another tab wrote the drafts store back without B's entry while B's
// save was on its way, and that save then failed: B went back to the old title with no note.
// Since PT-111 a tab drops text by removing the records it has read, here ones A heard of before
// B typed more: B's newer text stays.
test('a failed save keeps its text when another tab dropped it meanwhile', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  const a = await open(context, page);
  const b = await open(context);
  const release = await hold(b, 'PATCH', (url) => url.pathname === '/api/tickets/MOB-1');

  await typeAtEnd(b, ' from');
  await expect(titleOf(a)).toHaveValue('Ticket 1 from');
  const heard = await recordsHeard(a);
  await typeAtEnd(b, ' B');
  await expect(titleOf(a)).toHaveValue('Ticket 1 from B');
  await a.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), heard);
  release('fail');

  await expect(note(b)).toHaveText("Title isn't saved yet.");
  await expect(titleOf(b)).toHaveValue('Ticket 1 from B');
  await expect(titleOf(a)).toHaveValue('Ticket 1 from B');
  await b.unrouteAll({ behavior: 'ignoreErrors' });
  await b.getByRole('button', { name: 'Retry saving title' }).click();
  await expect.poll(() => trackerTitle(api)).toBe('Ticket 1 from B');
  await expect(note(b)).toHaveCount(0);
  await expect(note(a)).toHaveCount(0);
});

async function editComment(page: Page, text: string) {
  await activity(page).getByRole('button', { name: 'Comment options' }).click();
  await readActionSheet(page);
  await page.getByRole('button', { name: 'Edit comment' }).click();
  await page.getByLabel('Edit comment', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

const commentText = async (api: {
  getTicket: (key: string) => Promise<{ activity: Array<{ type: string; text: string }> }>;
}) => (await api.getTicket('MOB-1')).activity.find((item) => item.type === 'comment')?.text;

// Reviewer 77 (follow-up 3): a comment edit's save that hung landed after another tab's newer edit
// and overwrote it.
test('an older comment edit that lands late does not overwrite a newer one', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  await api.addComment('MOB-1', { text: 'First' });
  const a = await open(context, page);
  const b = await open(context);
  const release = await hold(a, 'PATCH', (url) => url.pathname.startsWith('/api/activity/'));

  await editComment(a, 'First, edited by A');
  await editComment(b, 'First, edited by B later');
  await expect.poll(() => commentText(api)).toBe('First, edited by B later');

  release('go');
  await expect(
    a.getByText("The comment changed elsewhere while your edit wasn't saved."),
  ).toBeVisible();
  await expect(a.getByLabel('Edit comment', { exact: true })).toHaveValue('First, edited by A');
  expect(await commentText(api)).toBe('First, edited by B later');
});

// Reviewer 77 (follow-up 4): a tab closed while its comment send hung lost the comment, and
// closing didn't ask.
test('a comment whose tab closes while it is sent comes back in the other tab', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  const a = await open(context, page);
  const b = await open(context);
  await hold(a, 'POST', (url) => url.pathname === '/api/tickets/MOB-1/comments');

  await box(a).fill('Looks good');
  await a.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(box(a)).toHaveValue('');
  await expect(box(b)).toHaveValue('');
  await box(b).pressSequentially('Also logout', { delay: 10 });
  // A person switches to A before closing it, by which time A has heard of B's typing.
  await expect(box(a)).toHaveValue('Also logout');

  // Closing asks first. Whether the browser shows the question is its own call (WebKit sometimes
  // doesn't), so the page's answer is read directly.
  const asks = await a.evaluate(() => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(asks).toBe(true);
  a.on('dialog', (dialog) => void dialog.accept());
  await a.close({ runBeforeUnload: true });
  await expect(box(b)).toHaveValue('Looks good\nAlso logout');
  await b.reload();
  await expect(box(b)).toHaveValue('Looks good\nAlso logout');
  expect((await api.getTicket('MOB-1')).activity.filter((item) => item.type === 'comment')).toEqual(
    [],
  );
});

// Reviewer 96 (PT-135): in WebKit under load, B's box was still empty 5 s after A closed mid-send.
// The closing page's removal of its mark of the send never reached storage, so B waited for the
// mark to run out, a minute after the send. Here A's last writes are lost on purpose.
test('a comment whose tab closes comes back though that tab’s last writes are lost', async ({
  page,
  context,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
  const a = await open(context, page);
  const b = await open(context);
  await hold(a, 'POST', (url) => url.pathname === '/api/tickets/MOB-1/comments');

  await box(a).fill('Looks good');
  await a.getByRole('button', { name: 'Comment', exact: true }).click();
  await expect(box(a)).toHaveValue('');
  await a.evaluate(() => {
    Storage.prototype.setItem = () => undefined;
    Storage.prototype.removeItem = () => undefined;
  });
  await a.close();
  await expect(box(b)).toHaveValue('Looks good');
  expect((await api.getTicket('MOB-1')).activity.filter((item) => item.type === 'comment')).toEqual(
    [],
  );
});
