import { randomUUID } from 'node:crypto';
import type { RunStepInput, RunTodo } from '@tracker/shared';
import { ask, HELPER } from './askChat';
import { expect, test } from './fixtures';
import { seedProject, settledScreenshot } from './helpers';

const LONG = 'Batch the capture uploads so a slow 3G connection sends ten at a time instead of one';

const listStep = (todos: RunTodo[], toolId: string): RunStepInput => ({
  kind: 'tool',
  label: 'Update the to-do list',
  subAgent: false,
  toolId,
  todos,
});
const read: RunStepInput = {
  kind: 'tool',
  label: 'Read apps/web/src/features/capture/useCaptureSync.ts',
  subAgent: false,
  toolId: 'toolu_r',
};

test("shows Claude's to-do list live, then keeps it folded on the answer", async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await ask(page, 'Make capture sync faster');
  const job = await api.takeNextRun(helperId, 'ask');
  const send = (steps: RunStepInput[]) =>
    api.addRunSteps(job!.run.id, { runnerId: helperId, steps });

  await send([
    listStep(
      [
        { text: 'Read the sync queue', status: 'in_progress' },
        { text: LONG, status: 'pending' },
      ],
      'toolu_1',
    ),
    read,
    listStep(
      [
        { text: 'Read the sync queue', status: 'completed' },
        { text: LONG, status: 'in_progress' },
      ],
      'toolu_2',
    ),
  ]);
  const working = page.getByRole('article', { name: 'Claude, working' });
  const todos = working.getByRole('list', { name: "Claude's to-do list" }).getByRole('listitem');
  await expect(todos).toHaveText(['Read the sync queue, done', `${LONG}, doing now`]);
  await expect(working.getByRole('list', { name: "Claude's steps" })).toHaveText(read.label);

  const own = page.viewportSize()!;
  for (const width of [320, own.width]) {
    await page.setViewportSize({ width, height: own.height });
    const box = (await todos.last().boundingBox())!;
    expect(box.x + box.width, `the list at ${width}px`).toBeLessThanOrEqual(width - 16);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await settledScreenshot(page, info.outputPath(`ask-todos-${width}.png`));
  }

  await api.finishRun(job!.run.id, { status: 'done', answer: 'Done.', sessionId: randomUUID() });
  // Read back from the tracker, as a person opening the chat later sees it.
  await page.reload();
  const answer = page.getByRole('article', { name: 'Claude', exact: true });
  const toggle = answer.getByRole('button', { name: 'To-do list, 1 of 2 done' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(answer.getByRole('list', { name: "Claude's to-do list" })).toBeVisible();
  await settledScreenshot(page, info.outputPath(`ask-todos-answer-${info.project.name}.png`));
});
