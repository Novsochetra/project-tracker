import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CHAT_ANSWER_MAX, type FinishRunInput } from '@tracker/shared';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { withAnswerImages, type AnswerImageDeps } from '../../../src/watch/ask/answerImages';

const work = realpathSync(mkdtempSync(join(tmpdir(), 'answer-images-')));
mkdirSync(join(work, 'docs'));
mkdirSync(join(work, '.secret'));
writeFileSync(
  join(work, 'docs', 'home.png'),
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]),
);
writeFileSync(join(work, 'docs', 'board.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
writeFileSync(join(work, 'docs', 'photo.heic'), 'heic');
writeFileSync(join(work, 'docs', 'notes.md'), '# Notes');
writeFileSync(join(work, '.secret', 'key.png'), 'png');
symlinkSync('/etc/hosts', join(work, 'docs', 'hosts.png'));

afterAll(() => rmSync(work, { recursive: true, force: true }));

const card = (path: string) => `\`\`\`\`image\npath: ${path}\n\`\`\`\``;
const done = (answer: string): FinishRunInput => ({ status: 'done', answer, sessionId: 's' });

function setup(
  upload = vi.fn((_file: Blob, name: string) => Promise.resolve({ id: `a-${name}` })),
) {
  const deps: AnswerImageDeps = {
    cwd: work,
    upload,
    describe: (error) => (error instanceof Error ? error.message : String(error)),
  };
  return { deps, upload };
}

describe('withAnswerImages', () => {
  it('uploads each picture a card names, in order, and keeps the answer as it is', async () => {
    const { deps, upload } = setup();
    const answer = `Two screens:\n${card('docs/home.png')}\n${card(join(work, 'docs/board.jpg'))}`;
    const outcome = await withAnswerImages(
      deps,
      done(answer),
      new AbortController().signal,
      'edit',
    );
    expect(outcome).toEqual({ ...done(answer), attachmentIds: ['a-home.png', 'a-board.jpg'] });
    expect(upload.mock.calls.map(([file, name]) => [file.type, name])).toEqual([
      ['image/png', 'home.png'],
      ['image/jpeg', 'board.jpg'],
    ]);
  });

  it('sends nothing from outside the folder, a dot-folder or a link, nor a file not a picture', async () => {
    const { deps, upload } = setup();
    const paths = [
      '../../../../../../etc/hosts',
      '.secret/key.png',
      'docs/hosts.png',
      'docs/notes.md',
      'docs/photo.heic',
      'docs/missing.png',
      'https://example.com/a.png',
    ];
    const answer = paths.map(card).join('\n');
    const outcome = await withAnswerImages(
      deps,
      done(answer),
      new AbortController().signal,
      'edit',
    );
    expect(upload).not.toHaveBeenCalled();
    expect(outcome.attachmentIds).toBeUndefined();
    const notes = outcome.answer?.slice(answer.length).trim().split('\n') ?? [];
    expect(notes).toHaveLength(paths.length);
    expect(notes[0]).toContain("Couldn't show ../../../../../../etc/hosts. Can't attach");
    expect(notes[1]).toContain('a folder whose name starts with a dot');
    expect(notes[3]).toContain(
      "Couldn't show docs/notes.md. notes.md isn't a PNG, JPEG, GIF or WebP",
    );
    expect(notes[4]).toContain("photo.heic isn't a PNG, JPEG, GIF or WebP");
  });

  it('keeps the pictures that went up when another fails, and fits the answer', async () => {
    const upload = vi
      .fn()
      .mockResolvedValueOnce({ id: 'a-1' })
      .mockRejectedValueOnce(new Error('The tracker is down.'));
    const { deps } = setup(upload);
    const answer = `${'x'.repeat(CHAT_ANSWER_MAX - 100)}\n${card('docs/home.png')}\n${card('docs/board.jpg')}`;
    const outcome = await withAnswerImages(
      deps,
      done(answer),
      new AbortController().signal,
      'edit',
    );
    expect(outcome.attachmentIds).toEqual(['a-1']);
    expect(outcome.answer?.length).toBeLessThanOrEqual(CHAT_ANSWER_MAX);
  });

  it('leaves an answer with no cards, a failed run and a stopped one alone', async () => {
    const { deps, upload } = setup();
    const signal = new AbortController().signal;
    expect(await withAnswerImages(deps, done('Plain.'), signal, 'edit')).toEqual(done('Plain.'));
    const failed: FinishRunInput = { status: 'failed', error: 'x' };
    expect(await withAnswerImages(deps, failed, signal, 'edit')).toBe(failed);
    const stop = new AbortController();
    stop.abort();
    const stopped = await withAnswerImages(deps, done(card('docs/home.png')), stop.signal, 'edit');
    expect(stopped).toEqual({ status: 'cancelled' });
    expect(upload).not.toHaveBeenCalled();
  });
});
