import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject } from './helpers';
import { hold, open } from './twoTabs';

// Temporary CI probe for PT-291; removed before review.

const box = (page: Page) => page.getByLabel('Comment', { exact: true });

const state = (page: Page) =>
  page.evaluate(async () => ({
    keys: Object.keys(localStorage).filter((key) => key.startsWith('tracker.')),
    locks: (await navigator.locks.query()).held?.map((lock) => lock.name),
    pending: (await navigator.locks.query()).pending?.map((lock) => lock.name),
    visible: document.visibilityState,
    focus: document.hasFocus(),
  }));

test('probe: pointerover before any mouse move', async ({ page, api }) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Login screen' }]);
  await page.addInitScript(() => {
    (window as unknown as { overs: string[] }).overs = [];
    for (const type of ['pointerover', 'pointerdown', 'keydown', 'mouseover']) {
      window.addEventListener(
        type,
        (event) =>
          (window as unknown as { overs: string[] }).overs.push(
            `${type}@${Math.round(performance.now())}:${(event.target as Element).tagName}`,
          ),
        true,
      );
    }
  });
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('ProjectScreen')) requests.push(request.url());
  });
  await page.goto('/');
  await page.waitForTimeout(1500);
  console.warn(
    'PROBE overs',
    await page.evaluate(() => (window as unknown as { overs: string[] }).overs),
  );
  console.warn('PROBE requests', requests);
});

for (const mode of ['beforeunload', 'lost-writes']) {
  test(`probe: tab closes mid-send (${mode})`, async ({ page, context, api }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Ticket 1' }]);
    const tabA = await open(context, page);
    const tabB = await open(context);
    for (const [name, tab] of [
      ['A', tabA],
      ['B', tabB],
    ] as const) {
      tab.on('console', (message) =>
        console.warn(`PROBE ${name} console`, message.type(), message.text()),
      );
      tab.on('request', (request) => {
        if (request.url().includes('/api/'))
          console.warn(`PROBE ${name} req`, request.method(), request.url());
      });
    }

    await hold(tabA, 'POST', (url) => url.pathname === '/api/tickets/MOB-1/comments');
    await box(tabA).fill('Looks good');
    await tabA.getByRole('button', { name: 'Comment', exact: true }).click();
    await expect(box(tabA)).toHaveValue('');
    await tabA.waitForTimeout(300);
    console.warn('PROBE A before', JSON.stringify(await state(tabA)));
    console.warn('PROBE B before', JSON.stringify(await state(tabB)));
    if (mode === 'lost-writes') {
      await tabA.evaluate(() => {
        Storage.prototype.setItem = () => undefined;
        Storage.prototype.removeItem = () => undefined;
      });
      await tabA.close();
    } else {
      tabA.on('dialog', (dialog) => void dialog.accept());
      await tabA.close({ runBeforeUnload: true });
    }

    console.warn('PROBE closed at', Date.now());
    for (let i = 0; i < 12; i++) {
      await tabB.waitForTimeout(500);
      console.warn(
        `PROBE B +${(i + 1) * 500}`,
        JSON.stringify(await state(tabB)),
        JSON.stringify(await box(tabB).inputValue()),
      );
    }
  });
}
