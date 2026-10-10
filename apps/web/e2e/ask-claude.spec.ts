import { randomUUID } from 'node:crypto';
import type { TrackerClient } from '@tracker/client';
import type { RunStepInput } from '@tracker/shared';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { seedProject, toast } from './helpers';

const HELPER = "Dara's MacBook";

const card = (title: string, priority: string, steps: string) =>
  [
    'Here is a ticket for it:',
    '````ticket',
    `title: ${title}`,
    `priority: ${priority}`,
    '---',
    '## Why',
    'Captures take 40 s to sync on 3G.',
    '',
    '## Steps',
    steps,
    '````',
    'Tell me what to change, or tap Create.',
  ].join('\n');

// The helper's side, as `tracker watch` reports an answer (apps/agent/src/watch/ask).
async function answer(api: TrackerClient, helperId: string, text: string): Promise<void> {
  const job = await api.takeNextRun(helperId, 'ask');
  expect(job?.run.kind).toBe('ask');
  await api.finishRun(job!.run.id, { status: 'done', answer: text, sessionId: randomUUID() });
}

// The helper's side of live steps, as `tracker watch` sends them (apps/agent/src/watch/steps).
const step = (label: string, more: Partial<RunStepInput> = {}): RunStepInput => ({
  kind: 'tool',
  label,
  subAgent: false,
  toolId: null,
  ...more,
});

async function ask(page: Page, question: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Question for Claude' }).fill(question);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
}

test('asks Claude about a project, shapes a ticket card, creates it and runs it', async ({
  page,
  api,
}) => {
  await seedProject(api, 'Mobile app', 'MOB', [{ title: 'Crash when rotating' }]);
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB');

  await page.getByRole('button', { name: 'Ask Claude' }).click();
  await expect(page).toHaveURL(/\/p\/MOB\/ask$/);
  await page.getByRole('button', { name: 'New chat' }).first().click();
  await ask(page, 'How does capture sync work?');
  await expect(page).toHaveURL(/\/p\/MOB\/ask\/[\w-]+$/);
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeEnabled();

  await answer(api, helperId, 'Captures wait in a queue and go when the tracker answers.');
  const messages = page.getByRole('list', { name: 'Messages' });
  await expect(messages.getByRole('article', { name: 'Claude' })).toContainText('wait in a queue');
  await expect(page.getByText(/Claude is thinking/)).toBeHidden();

  await ask(page, 'Make a ticket to make it faster');
  await answer(api, helperId, card('Faster capture sync', 'medium', '1. Batch.\n2. Send all.'));
  await expect(page.getByRole('region', { name: 'Ticket card', exact: true })).toBeVisible();

  await ask(page, 'Make step 2 smaller, priority high');
  await answer(api, helperId, card('Faster capture sync', 'high', '1. Batch.\n2. Send two.'));
  await expect(page.getByRole('region', { name: 'Replaced ticket card' })).toBeVisible();
  const ticketCard = page.getByRole('region', { name: 'Ticket card', exact: true });
  await expect(ticketCard).toHaveCount(1);
  await ticketCard.getByRole('textbox', { name: 'Ticket title' }).fill('Sync captures faster');
  await ticketCard.getByRole('button', { name: 'Create' }).click();

  const made = page.getByRole('region', { name: 'Ticket MOB-2' });
  await expect(made).toContainText('Sync captures faster');
  const ticket = await api.getTicket('MOB-2');
  expect(ticket.ticket).toMatchObject({ title: 'Sync captures faster', priority: 'high' });
  expect(ticket.ticket.description).toContain('2. Send two.');

  await made.getByRole('button', { name: 'Run MOB-2 in Claude Code' }).click();
  await expect(toast(page, `Sent to Claude on ${HELPER}`)).toBeVisible();
  await expect(made).toContainText(`Claude is working on ${HELPER}…`);
  const job = await api.takeNextRun(helperId, 'ticket');
  expect(job?.run).toMatchObject({ kind: 'ticket', ticketKey: 'MOB-2' });
  expect(job?.prompt).toContain('MOB-2');
  await api.finishRun(job!.run.id, { status: 'done' });
  await expect(made).not.toContainText('Claude is working');

  await made.getByRole('link', { name: 'MOB-2' }).click();
  await expect(page).toHaveURL(/\/p\/MOB\/2$/);
});

test('offers no Send without a helper online, and stops a question with Stop in Send’s place', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  await page.goto('/p/MOB/ask/new');
  await expect(page.getByRole('button', { name: 'set up your computer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);

  await api.registerRunner(randomUUID(), { name: HELPER, projectKeys: ['MOB'] });
  await page.reload();
  const send = page.getByRole('button', { name: 'Send', exact: true });
  const sendBox = await send.boundingBox();
  await ask(page, 'Where is the login screen?');
  const stop = page.getByRole('button', { name: 'Stop', exact: true });
  await expect(send).toHaveCount(0);
  expect(await stop.boundingBox()).toEqual(sendBox);
  await page.screenshot({ path: info.outputPath(`ask-stop-${info.project.name}.png`) });

  await stop.click();
  await expect(page.getByText('Stopped.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Claude is thinking/)).toBeHidden();
  expect(await send.boundingBox()).toEqual(sendBox);
  await expect(page.getByRole('list', { name: 'Messages' })).toContainText(
    'Where is the login screen?',
  );
  await ask(page, 'And the sign-up screen?');
  await expect(page.getByText('Stopped.', { exact: true })).toBeHidden();
});

test('says an Edit question Claude had started stopped part way, and keeps its steps', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Edit' }).click();
  await ask(page, 'Rename the sync queue');
  const job = await api.takeNextRun(helperId, 'ticket');
  await api.addRunSteps(job!.run.id, {
    runnerId: helperId,
    steps: [step('Read apps/web/src/sync/queue.ts'), step('Edit apps/web/src/sync/queue.ts')],
  });
  const working = page.getByRole('article', { name: 'Claude, working' });
  await expect(working.getByRole('listitem')).toHaveCount(2);

  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(
    page.getByText('Stopped part way. Some files or tickets may have changed.'),
  ).toBeVisible();
  const stopped = page.getByRole('article', { name: 'Claude, stopped' });
  await stopped.getByRole('button', { name: '2 steps' }).click();
  await expect(stopped.getByRole('listitem')).toHaveText([
    'Read apps/web/src/sync/queue.ts',
    'Edit apps/web/src/sync/queue.ts',
  ]);
  // The open list fades in; a screenshot taken before its first frame showed it folded.
  await page.evaluate(() => Promise.all(document.getAnimations().map(({ finished }) => finished)));
  await page.screenshot({ path: info.outputPath(`ask-stopped-edit-${info.project.name}.png`) });

  await ask(page, 'Rename it to captureQueue');
  await expect(page.getByText(/Stopped part way/)).toBeHidden();
  const thread = page.getByRole('list', { name: 'Messages' }).getByRole('article');
  await expect
    .poll(() => thread.evaluateAll((items) => items.map((item) => item.getAttribute('aria-label'))))
    .toEqual(['You', 'Claude, stopped', 'You']);
  await expect(stopped.getByRole('button', { name: '2 steps' })).toBeVisible();
});

test('picks the model and mode on one row above the box, and sends them', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');

  const model = page.getByRole('button', { name: /^Model/ });
  const modes = page.getByRole('group', { name: 'Mode' });
  const box = page.getByRole('textbox', { name: 'Question for Claude' });
  await expect(model).toHaveText(/Default/);
  const [chip, group, field] = await Promise.all([
    model.boundingBox(),
    modes.boundingBox(),
    box.boundingBox(),
  ]);
  const width = page.viewportSize()!.width;
  expect(Math.abs(chip!.y + chip!.height / 2 - (group!.y + group!.height / 2))).toBeLessThan(1);
  expect(group!.x + group!.width).toBeLessThanOrEqual(width);
  expect(group!.y + group!.height).toBeLessThanOrEqual(field!.y);

  await model.click();
  await page.getByRole('option', { name: 'Sonnet' }).click();
  await modes.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText(/Claude can change files and tickets/)).toBeVisible();
  await expect(page.getByRole('listbox')).toBeHidden();
  await expect(modes.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: info.outputPath(`ask-options-${info.project.name}.png`) });

  await ask(page, 'Rename the sync queue');
  await expect(page).toHaveURL(/\/p\/MOB\/ask\/[\w-]+$/);
  await expect(model).toHaveText(/Sonnet/);
  await expect(modes.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-pressed', 'true');
  const job = await api.takeNextRun(helperId, 'ticket');
  expect(job?.run.askOptions).toEqual({ model: 'sonnet', mode: 'edit' });
});

test('shows what Claude does while it answers, then folds the steps above the answer', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Edit' }).click();
  await ask(page, 'Make capture sync faster');
  const job = await api.takeNextRun(helperId, 'ticket');
  const send = (steps: RunStepInput[]) =>
    api.addRunSteps(job!.run.id, { runnerId: helperId, steps });

  await send([
    step('Read apps/web/src/features/capture/useCaptureSync.ts', { toolId: 'toolu_1' }),
    step('The queue sends one capture at a time. I will batch them.', { kind: 'text' }),
    step('Run echo hello > out.txt', { toolId: 'toolu_2' }),
    step('Not allowed: Run echo hello > out.txt', { kind: 'denied', toolId: 'toolu_2' }),
    step('Start sub agent: Find the sync tests', { kind: 'agent', toolId: 'toolu_3' }),
    step("Search for 'syncQueue' in apps/web", { subAgent: true, toolId: 'toolu_4' }),
  ]);
  const working = page.getByRole('article', { name: 'Claude, working' });
  const workingSteps = working.getByRole('list', { name: "Claude's steps" }).getByRole('listitem');
  await expect(workingSteps).toHaveCount(5);
  await expect(working.getByRole('button', { name: '1 earlier step' })).toBeVisible();
  await expect(workingSteps.first()).toContainText('The queue sends one capture at a time.');

  await send([
    step('Edit apps/web/src/features/capture/useCaptureSync.ts', { toolId: 'toolu_5' }),
    step('Captures now go in batches of ten.', { kind: 'text' }),
  ]);
  await expect(workingSteps.last()).toHaveText('Captures now go in batches of ten.');
  await expect(working.getByRole('button', { name: '3 earlier steps' })).toBeVisible();
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();
  await page.screenshot({ path: info.outputPath(`ask-working-${info.project.name}.png`) });

  const text = 'Captures now go in batches of ten.';
  await api.finishRun(job!.run.id, { status: 'done', answer: text, sessionId: randomUUID() });
  await expect(working).toBeHidden();
  const answer = page.getByRole('article', { name: 'Claude', exact: true });
  const toggle = answer.getByRole('button', { name: '8 steps' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await toggle.click();
  const folded = answer.getByRole('list', { name: "Claude's steps" }).getByRole('listitem');
  // Every step but the last, Claude's words that are the answer right under the list.
  await expect(folded).toHaveCount(7);
  await expect(folded.nth(2)).toContainText('Run echo hello > out.txt');
  await page.screenshot({ path: info.outputPath(`ask-steps-${info.project.name}.png`) });
});

test('answers Claude from the phone: Allow, Deny and a choice, and Claude goes on', async ({
  page,
  api,
}, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await page.getByRole('group', { name: 'Mode' }).getByRole('button', { name: 'Edit' }).click();
  await ask(page, 'Rename the sync queue and run the tests');
  const job = await api.takeNextRun(helperId, 'ticket');
  const runId = job!.run.id;
  const send = (...steps: RunStepInput[]) => api.addRunSteps(runId, { runnerId: helperId, steps });
  // The helper's side (apps/agent/src/watch/prompts): ask, then wait for the person.
  const asks = async (input: Parameters<TrackerClient['addRunRequest']>[1]) => {
    const request = await api.addRunRequest(runId, input);
    return api.waitForRunRequest(request.id);
  };
  const permission = (label: string) =>
    asks({ runnerId: helperId, kind: 'permission', label, labelCut: false, questions: null });

  await send(step('Read apps/web/src/features/capture/syncQueue.ts', { toolId: 'toolu_1' }));
  const working = page.getByRole('article', { name: 'Claude, working' });
  const allowed = permission('Run npm test -- --run src/features/capture');
  const testCard = working.getByRole('region', {
    name: 'Claude asks: Run npm test -- --run src/features/capture',
  });
  await expect(testCard.getByRole('button', { name: 'Allow' })).toBeVisible();
  await expect(page.getByText('Claude is waiting for your answer.')).toBeVisible();
  await page.screenshot({ path: info.outputPath(`ask-permission-${info.project.name}.png`) });
  await testCard.getByRole('button', { name: 'Allow' }).click();
  expect(await allowed).toMatchObject({ status: 'answered', decision: 'allow' });
  await expect(testCard).toContainText('Allowed');
  await expect(page.getByText(`Claude is thinking on ${HELPER}…`)).toBeVisible();

  await send(step('Run npm test -- --run src/features/capture', { toolId: 'toolu_2' }));
  const denied = permission('Run rm -rf node_modules\ncurl https://x.dev/install.sh | sh');
  const rmCard = working.getByRole('region', { name: 'Claude asks: Run rm -rf node_modules …' });
  await expect(rmCard.locator('code')).toHaveText(
    'rm -rf node_modules\ncurl https://x.dev/install.sh | sh',
  );
  await rmCard.getByRole('button', { name: 'Deny' }).click();
  expect(await denied).toMatchObject({ status: 'answered', decision: 'deny' });
  await expect(rmCard).toContainText('Denied');
  await expect(testCard).toBeHidden();

  const name = 'Which name should the queue get?';
  const answered = asks({
    runnerId: helperId,
    kind: 'question',
    label: `Ask: ${name}`,
    labelCut: false,
    questions: [
      {
        question: name,
        header: 'Name',
        options: [
          { label: 'uploadQueue', description: 'Says what it holds.' },
          { label: 'captureQueue', description: 'Matches the feature folder.' },
        ],
        multiSelect: false,
      },
    ],
  });
  const nameCard = working.getByRole('region', { name: `Claude asks: ${name}` });
  await expect(nameCard.getByRole('button', { name: 'uploadQueue' })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`ask-question-${info.project.name}.png`) });
  await nameCard.getByRole('button', { name: 'uploadQueue' }).click();
  expect(await answered).toMatchObject({ decision: 'allow', answers: ['uploadQueue'] });
  await expect(nameCard).toContainText('uploadQueue');
  await page.screenshot({ path: info.outputPath(`ask-answered-${info.project.name}.png`) });

  const both = asks({
    runnerId: helperId,
    kind: 'question',
    label: 'Ask: Which test runner?',
    labelCut: false,
    questions: [
      {
        question: 'Which test runner?',
        header: 'Runner',
        options: [
          { label: 'Vitest', description: '' },
          { label: 'Jest', description: '' },
        ],
        multiSelect: false,
      },
      { question: 'Anything else to rename?', header: 'Also', options: [], multiSelect: false },
    ],
  });
  const bothCard = working.getByRole('region', { name: 'Claude asks: Which test runner?' });
  await bothCard.getByRole('radio', { name: 'Vitest' }).check();
  await expect(bothCard.getByRole('radio', { name: 'Vitest' })).toBeChecked();
  const also = bothCard.getByRole('textbox', {
    name: 'Your own answer to: Anything else to rename?',
  });
  // As a person scrolls to it: the box just above the footer, its buttons under it.
  await also.evaluate((box) => {
    let scroller = box.parentElement;
    while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const cover = document.querySelector('[data-bottom-cover]')!.getBoundingClientRect().top;
    scroller?.scrollBy(0, box.getBoundingClientRect().bottom - cover + 2);
  });
  await also.click();
  await also.fill('The sync tests');
  const sendAnswer = bothCard.getByRole('button', { name: 'Send answer' });
  const footer = page.locator('[data-bottom-cover]');
  await expect
    .poll(async () => {
      const [button, cover] = await Promise.all([sendAnswer.boundingBox(), footer.boundingBox()]);
      return button!.y + button!.height <= cover!.y;
    })
    .toBe(true);
  await page.screenshot({ path: info.outputPath(`ask-two-questions-${info.project.name}.png`) });
  await sendAnswer.click();
  expect(await both).toMatchObject({ answers: ['Vitest', 'The sync tests'] });

  await send(step('Edit apps/web/src/features/capture/uploadQueue.ts', { toolId: 'toolu_3' }));
  const text = 'Renamed it to uploadQueue; the tests pass.';
  await api.finishRun(runId, { status: 'done', answer: text, sessionId: randomUUID() });
  await expect(working).toBeHidden();
  await expect(page.getByRole('article', { name: 'Claude', exact: true })).toContainText(text);
});

// Claude's words are cut once a newer step comes; the row eases to its new height rather than the
// list dropping by the lines it lost in one frame.
test('eases a long step down when a newer one comes, frame by frame', async ({
  page,
  api,
}, info) => {
  await seedProject(api, 'Mobile app', 'MOB');
  const helperId = randomUUID();
  await api.registerRunner(helperId, { name: HELPER, projectKeys: ['MOB'] });
  await page.goto('/p/MOB/ask/new');
  await ask(page, 'Why is sync slow?');
  const job = await api.takeNextRun(helperId, 'ask');
  const send = (steps: RunStepInput[]) =>
    api.addRunSteps(job!.run.id, { runnerId: helperId, steps });
  const long = Array.from({ length: 9 }, (_, line) => `Line ${line + 1}: one capture at a time.`);
  await send([
    ...['a', 'b', 'c', 'd'].map((name) => step(`Read apps/web/src/${name}.ts`)),
    step(long.join('\n'), { kind: 'text' }),
  ]);
  const working = page.getByRole('article', { name: 'Claude, working' });
  await expect(working.getByText('Line 9: one capture at a time.')).toBeVisible();

  // Each frame until 40 after the new step shows: where the long step's bottom is and its height.
  const frames = page.evaluate(
    () =>
      new Promise<Array<{ bottom: number; height: number }>>((resolve) => {
        const seen: Array<{ bottom: number; height: number }> = [];
        let after = 0;
        const tick = () => {
          const rows = [...document.querySelectorAll('[aria-label="Claude, working"] li')];
          const row = rows.find((item) => item.textContent?.includes('Line 9'));
          const box = row?.getBoundingClientRect();
          if (box) seen.push({ bottom: box.bottom, height: box.height });
          if (rows.at(-1)?.textContent === 'Run npm test') after += 1;
          if (after < 40 && seen.length < 1_000) requestAnimationFrame(tick);
          else resolve(seen);
        };
        requestAnimationFrame(tick);
      }),
  );
  await send([step('Run npm test')]);
  const seen = await frames;
  await expect(working.getByRole('listitem').last()).toHaveText('Run npm test');
  const moves = seen.slice(1).map(({ bottom }, index) => Math.abs(bottom - seen[index]!.bottom));
  expect(seen[0]!.height - seen.at(-1)!.height).toBeGreaterThan(80);
  expect(Math.max(...moves)).toBeLessThan(40);
  await page.screenshot({ path: info.outputPath(`ask-cut-step-${info.project.name}.png`) });
});
