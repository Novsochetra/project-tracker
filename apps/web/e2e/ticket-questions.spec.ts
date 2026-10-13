import type { Page } from '@playwright/test';
import { expect, isPhone, test } from './fixtures';
import { activity, seedProject, settledScreenshot } from './helpers';

const QUESTION = 'Should the setting be called Dark mode or Night mode?';

const card = (page: Page) => page.getByRole('region', { name: `Claude asks: ${QUESTION}` });

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(fits).toBe(true);
}

test.describe('Claude asks a question on the ticket', () => {
  test('shows it under the run card, and the answer reaches Claude', async ({
    page,
    api,
    agent,
  }, info) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Dark mode for Settings' }]);
    await page.goto('/p/MOB/1');
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue(
      'Dark mode for Settings',
    );

    const asked = await agent.askQuestion('MOB-1', {
      question: QUESTION,
      choices: ['Dark mode', 'Night mode'],
    });
    const shown = card(page);
    await expect(shown.getByText('Claude asks you')).toBeVisible();
    await expect(shown.getByRole('button', { name: 'Night mode' })).toBeVisible();
    await expect(
      shown.getByRole('textbox', { name: `Your own answer to: ${QUESTION}` }),
    ).toBeVisible();
    await expect(activity(page).getByText(`asked: ${QUESTION}`)).toBeVisible();
    await expectNoSidewaysScroll(page);
    const width = isPhone(info.project.name) ? 375 : 1280;
    await settledScreenshot(page, info.outputPath(`question-open-${width}.png`));

    const answered = agent.waitForQuestion(asked.id);
    await shown.getByRole('button', { name: 'Night mode' }).click();
    await expect(shown.getByRole('button')).toHaveCount(0);
    await expect(shown.getByText('Night mode', { exact: true })).toBeVisible();
    expect(await answered).toMatchObject({ status: 'answered', answer: 'Night mode' });
    await expect(activity(page).getByText('answered: Night mode')).toBeVisible();
    await settledScreenshot(page, info.outputPath(`question-answered-${width}.png`));
  });

  test("takes the person's own words", async ({ page, api, agent }) => {
    await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Dark mode for Settings' }]);
    const asked = await agent.askQuestion('MOB-1', { question: QUESTION });
    await page.goto('/p/MOB/1');
    const shown = card(page);
    await shown.getByRole('textbox').fill('Call it Dusk');
    await shown.getByRole('button', { name: 'Send answer' }).click();
    await expect(shown.getByText('Call it Dusk', { exact: true })).toBeVisible();
    expect(await agent.waitForQuestion(asked.id)).toMatchObject({ answer: 'Call it Dusk' });
  });
});
