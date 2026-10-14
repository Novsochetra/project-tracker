import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FinishRunInput } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { withAnswerImages } from '../../src/watch/ask/answerImages';

// PT-225 review: Ask and Plan took pictures from the temp folders too, though their prompt says
// the project folder only, and they make no files to show.
const project = realpathSync(mkdtempSync(join(tmpdir(), 'answer-project-')));
const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), 'answer-elsewhere-')));
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
writeFileSync(join(project, 'home.png'), PNG);
writeFileSync(join(elsewhere, 'temp.png'), PNG);

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
  rmSync(elsewhere, { recursive: true, force: true });
});

const card = (path: string) => `\`\`\`\`image\npath: ${path}\n\`\`\`\``;
const answer = `${card('home.png')}\n${card(join(elsewhere, 'temp.png'))}`;
const done: FinishRunInput = { status: 'done', answer, sessionId: 's' };

async function shownIn(mode: unknown) {
  const upload = vi.fn((_file: Blob, name: string) => Promise.resolve({ id: name }));
  const deps = { cwd: project, upload, describe: (error: unknown) => String(error) };
  return (await withAnswerImages(deps, done, new AbortController().signal, mode)).attachmentIds;
}

describe('pictures in a read-only answer', () => {
  it.each(['ask', 'plan', undefined])('come from the project folder only in %s', async (mode) => {
    expect(await shownIn(mode)).toEqual(['home.png']);
  });

  it.each(['edit', 'auto'])('may come from a temp folder in %s', async (mode) => {
    expect(await shownIn(mode)).toEqual(['home.png', 'temp.png']);
  });
});
