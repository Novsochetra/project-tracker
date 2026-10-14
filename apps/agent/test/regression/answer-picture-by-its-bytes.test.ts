import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FinishRunInput } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { withAnswerImages } from '../../src/watch/ask/answerImages';

// PT-225 review: only the name was checked, so a prompt-injected answer could send any file
// named *.png, which the tracker kept as it came.
const work = realpathSync(mkdtempSync(join(tmpdir(), 'answer-bytes-')));
const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
writeFileSync(join(work, 'real.png'), Buffer.from([...PNG_START, 1, 2, 3]));
writeFileSync(join(work, 'secrets.png'), 'API_KEY=abc\n');
writeFileSync(join(work, 'drawing.png'), '<svg xmlns="http://www.w3.org/2000/svg"/>');

afterAll(() => rmSync(work, { recursive: true, force: true }));

const card = (path: string) => `\`\`\`\`image\npath: ${path}\n\`\`\`\``;
const done = (answer: string): FinishRunInput => ({ status: 'done', answer, sessionId: 's' });

describe('a picture in an answer', () => {
  it('goes up only when its bytes are a PNG, JPEG, GIF or WebP, whatever its name', async () => {
    const upload = vi.fn((_file: Blob, name: string) => Promise.resolve({ id: `a-${name}` }));
    const deps = { cwd: work, upload, describe: (error: unknown) => String(error) };
    const answer = ['secrets.png', 'drawing.png', 'real.png'].map(card).join('\n');
    const outcome = await withAnswerImages(deps, done(answer), new AbortController().signal, 'ask');
    expect(upload.mock.calls.map(([, name]) => name)).toEqual(['real.png']);
    expect(outcome.attachmentIds).toEqual(['a-real.png']);
    expect(outcome.answer).toContain("Couldn't show secrets.png");
    expect(outcome.answer).toContain("Couldn't show drawing.png");
  });
});
