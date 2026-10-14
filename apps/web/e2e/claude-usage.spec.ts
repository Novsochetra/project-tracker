import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';
import { removeOwner, setOwner, signIn } from './owner';

const HOUR = 60 * 60 * 1000;

test.describe('Claude usage', () => {
  test.afterEach(async ({ request }) => {
    await removeOwner(request);
  });

  test("Account shows each computer's plan windows as of its last run", async ({
    page,
    api,
  }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash when rotating' }]);
    const mac = randomUUID();
    await api.registerRunner(mac, { name: 'Dara’s MacBook Pro', projectKeys: ['MOB'] });
    await api.registerRunner(randomUUID(), { name: 'Linux server', projectKeys: ['MOB'] });

    // The helper's side, as `tracker watch` ends a run (apps/agent/src/watch/stream/planLimits).
    await api.startRun('MOB-1', { runnerId: mac, prompt: 'Fix MOB-1, please.' });
    const run = await api.takeNextRun(mac, 'ticket');
    const fiveHour = Date.now() + 2 * HOUR;
    const week = Date.now() + 4 * 24 * HOUR;
    await api.finishRun(run!.run.id, {
      status: 'done',
      planLimits: {
        status: 'allowed_warning',
        rateLimitType: 'five_hour',
        windows: {
          five_hour: { usedPercent: 83, resetsAt: fiveHour },
          seven_day: { usedPercent: 21, resetsAt: week },
        },
      },
    });

    setOwner();
    await page.goto('/');
    await signIn(page);
    await page.getByRole('button', { name: 'Account' }).first().click();
    const sheet = page.getByRole('dialog', { name: 'Account' });
    const row = sheet.getByRole('listitem', { name: 'Dara’s MacBook Pro' });
    await expect(row).toContainText('Close to the 5-hour limit');
    await expect(row).toContainText(/83% used · resets/);
    await expect(row.getByRole('meter', { name: 'Weekly used' })).toHaveAttribute(
      'aria-valuenow',
      '21',
    );
    await expect(row).toContainText('As of a run that ended just now');
    await expect(sheet.getByRole('listitem', { name: 'Linux server' })).toContainText(
      'Unknown: Claude Code hasn’t said yet.',
    );
    const section = sheet.getByRole('region', { name: 'Claude usage' });
    const fits = async (name: string) => {
      await section.scrollIntoViewIfNeeded();
      const box = await section.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await settledScreenshot(page, info.outputPath(`claude-usage-${name}.png`));
    };
    await fits(info.project.name);
    if (info.project.name !== 'phone') return;
    await page.setViewportSize({ width: 320, height: 640 });
    await fits('320');
  });
});
