import { randomUUID } from 'node:crypto';
import type { Locator, Page } from '@playwright/test';
import { TrackerClient } from '@tracker/client';
import { formatShortDay, toYmd, type AddRunRequestInput, type RunQuestion } from '@tracker/shared';
import { expect, isPhone, test } from './fixtures';
import { group, seedProject, settled, settledScreenshot, ticketRow } from './helpers';
import { API_URL } from './ports';

const HELPER = "Dara's MacBook";
const TITLE = 'Crash when rotating the profile screen twice on a small phone in dark mode';
const DUE = toYmd(new Date());
const FILES = 'Which files should hold the fix?';

const QUESTION: RunQuestion = {
  question: FILES,
  header: 'Files',
  options: [
    { label: 'rotate.ts', description: 'Where the screen turns.' },
    { label: 'layout.ts', description: 'Where the sizes are read.' },
    { label: 'profile.tsx', description: 'The screen that crashes.' },
    { label: 'theme.ts', description: 'Where dark mode starts.' },
  ],
  multiSelect: false,
};

const reviewer = new TrackerClient({
  baseUrl: API_URL,
  actor: { kind: 'agent', name: 'Reviewer' },
});

const mark = (scope: Locator) => scope.getByText('Waiting for you', { exact: true });

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (!found) throw new Error('The element is not rendered.');
  return found;
}

async function showView(page: Page, view: 'List' | 'Board'): Promise<void> {
  const views = page.getByRole('group', { name: 'Show tickets as' });
  await views.getByRole('button', { name: view }).click();
  await expect(views.getByRole('button', { name: view })).toHaveAttribute('aria-pressed', 'true');
}

async function startWaitingRun(api: TrackerClient, projectKey = 'MOB') {
  const runnerId = randomUUID();
  await api.registerRunner(runnerId, { name: HELPER, projectKeys: [projectKey] });
  await api.startRun(`${projectKey}-1`, { runnerId, prompt: `Fix ${projectKey}-1, please.` });
  const job = await api.takeNextRun(runnerId, 'ticket');
  const runId = job!.run.id;
  const question: AddRunRequestInput = {
    runnerId,
    kind: 'question',
    label: `Ask: ${FILES}`,
    labelCut: false,
    questions: [QUESTION],
  };
  const permission: AddRunRequestInput = {
    runnerId,
    kind: 'permission',
    label: 'Run npm test',
    labelCut: false,
    questions: null,
  };
  const ask = (input: AddRunRequestInput = question) => api.addRunRequest(runId, input);
  return { runnerId, runId, ask, permission };
}

// On a phone the mark takes the due date's place on the row's second line, beside the key, clear
// of the avatar, without making the row taller than a plain one or anything overflow.
async function expectOnSecondLine(page: Page, row: Locator): Promise<void> {
  await settled(row);
  const words = await box(mark(row));
  const key = await box(row.getByText('MOB-1', { exact: true }));
  const avatar = await box(row.getByRole('img', { name: 'Claude' }));
  expect(Math.abs(words.y + words.height / 2 - (key.y + key.height / 2))).toBeLessThanOrEqual(1);
  expect(words.x).toBeGreaterThan(key.x + key.width);
  expect(words.x + words.width).toBeLessThanOrEqual(avatar.x);
  await expect(row.getByText(formatShortDay(DUE))).toBeHidden();
  const plain = await box(ticketRow(page, 'MOB-2'));
  expect((await box(row)).height).toBeCloseTo(plain.height, 1);
  expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
}

test.describe('Claude waiting for the person', () => {
  test('shows on the row and card, and a tap opens the ticket with the question in sight', async ({
    page,
    api,
  }, info) => {
    // A list, a board and a ticket at two phone widths take most of the default 30 s under load.
    test.slow();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedProject(api, 'Mobile app', 'MOB', [
      { title: 'Crash on rotate', priority: 'high', assignee: 'Claude', due: DUE },
      { title: 'Fresh idea', priority: 'high', assignee: 'Dara', due: DUE },
    ]);
    await api.updateTicket('MOB-1', { title: TITLE });
    const { ask } = await startWaitingRun(api);
    await page.goto('/p/MOB');
    const row = ticketRow(page, 'MOB-1');
    await expect(group(page, 'To do')).toContainText(TITLE);
    await expect(mark(row)).toHaveCount(0);

    await ask();
    await expect(mark(row)).toBeVisible();
    await expect(row).toHaveAccessibleName(/^MOB-1 .* Claude is waiting for you\b/);
    await expect(mark(ticketRow(page, 'MOB-2'))).toHaveCount(0);
    if (isPhone(info.project.name)) {
      await api.updateTicket('MOB-1', { title: 'Crash on rotate' });
      await expect(row).toHaveAccessibleName(/^MOB-1 Crash on rotate Claude is waiting/);
      await expectOnSecondLine(page, row);
      await settledScreenshot(page, info.outputPath('waiting-list-375.png'));
      await page.setViewportSize({ width: 320, height: 568 });
      await expectOnSecondLine(page, row);
      await settledScreenshot(page, info.outputPath('waiting-list-320.png'));
      await page.setViewportSize({ width: 375, height: 812 });
      await api.updateTicket('MOB-1', { title: TITLE });
      await expect(row).toHaveAccessibleName(new RegExp(`^MOB-1 ${TITLE}`));
    } else {
      await settledScreenshot(page, info.outputPath('waiting-list-1280.png'));
    }

    await showView(page, 'Board');
    const card = ticketRow(page, 'MOB-1');
    await expect(mark(card)).toBeVisible();
    await expect(card.getByText(formatShortDay(DUE))).toBeVisible();
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await settledScreenshot(page, info.outputPath(`waiting-board-${info.project.name}.png`));
    await showView(page, 'List');

    await ticketRow(page, 'MOB-1').click();
    const asked = page.getByRole('region', { name: `Claude asks: ${FILES}` });
    await expect(asked).toBeVisible();
    await settled(asked);
    if (isPhone(info.project.name)) {
      const scrolled = await asked.evaluate(
        (element) => element.closest('[data-stack-scroller]')!.scrollTop,
      );
      expect(scrolled).toBeGreaterThan(0);
      const shown = await box(asked);
      const navBar = await box(page.locator('[data-navbar]').last());
      const bottomBar = await box(page.locator('[data-bottom-bar]').last());
      expect(shown.y).toBeGreaterThanOrEqual(navBar.y + navBar.height);
      expect(shown.y + shown.height).toBeLessThanOrEqual(bottomBar.y);
    } else {
      await expect(asked).toBeInViewport({ ratio: 1 });
    }
    await settledScreenshot(page, info.outputPath(`waiting-ticket-${info.project.name}.png`));

    await asked.getByRole('button', { name: /^layout\.ts/ }).click();
    await expect(asked.getByRole('button')).toHaveCount(0);
    await page.goBack();
    await expect(ticketRow(page, 'MOB-1')).toBeVisible();
    await expect(mark(ticketRow(page, 'MOB-1'))).toHaveCount(0);
  });

  test('goes once the request ends, and once the run does', async ({ page, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash on rotate', due: DUE }]);
    const { ask, permission, runnerId, runId } = await startWaitingRun(api);
    await page.goto('/p/MOB');
    const row = ticketRow(page, 'MOB-1');
    await expect(row).toBeVisible();

    const first = await ask(permission);
    await expect(mark(row)).toBeVisible();
    await api.cancelRunRequest(first.id, { runnerId });
    await expect(mark(row)).toHaveCount(0);

    await showView(page, 'Board');
    await ask(permission);
    await expect(mark(ticketRow(page, 'MOB-1'))).toBeVisible();
    await api.finishRun(runId, { status: 'failed', error: 'Claude exited with code 1.' });
    await expect(mark(ticketRow(page, 'MOB-1'))).toHaveCount(0);
  });

  test('keeps only its icon beside the key and chip of a sent-back row at 320px', async ({
    page,
    api,
    agent,
  }, info) => {
    test.skip(!isPhone(info.project.name), 'Only a phone row puts the mark beside the key.');
    await seedProject(api, 'Tracker', 'TRACK', [
      { title: 'Crash on rotate', assignee: 'Claude', due: DUE },
      { title: 'Fresh idea', assignee: 'Dara', due: DUE },
    ]);
    await agent.claimTicket('TRACK-1');
    await agent.submitForReview('TRACK-1', { summary: 'Rotation keeps the layout.' });
    await reviewer.reviewTicket('TRACK-1', {
      verdict: 'changes_requested',
      rating: 2,
      summary: 'Still crashes.',
    });
    const { ask } = await startWaitingRun(api, 'TRACK');
    await ask();
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/p/TRACK');
    const row = ticketRow(page, 'TRACK-1');
    await expect(row).toHaveAccessibleName(
      /^TRACK-1 Crash on rotate Claude is waiting for you Changes requested/,
    );
    await settled(row);

    const words = mark(row);
    const shown = await box(words.locator('..'));
    const icon = await box(words.locator('..').locator('svg'));
    const key = await box(row.getByText('TRACK-1', { exact: true }));
    const chip = await box(row.locator('[data-verdict="changes_requested"]'));
    const avatar = await box(row.getByRole('img', { name: 'Claude' }));
    expect(Math.abs(shown.y + shown.height / 2 - (key.y + key.height / 2))).toBeLessThanOrEqual(1);
    expect(icon.x).toBeGreaterThanOrEqual(chip.x + chip.width);
    expect(icon.x + icon.width).toBeLessThanOrEqual(avatar.x);
    expect((await box(words)).y).toBeGreaterThanOrEqual(shown.y + shown.height);
    await expect(row.getByText(formatShortDay(DUE))).toBeHidden();
    const plain = await box(ticketRow(page, 'TRACK-2'));
    expect((await box(row)).height).toBeCloseTo(plain.height, 1);
    expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await settledScreenshot(page, info.outputPath('waiting-sent-back-320.png'));
  });
});
