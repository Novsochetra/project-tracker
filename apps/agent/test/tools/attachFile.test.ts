import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { attachFile, nameList } from '../../src/tools/attachFile';
import { fakeClient, returns } from '../fakeClient';
import { activity, attachment } from '../fixtures';
import { run } from './run';

const work = realpathSync(mkdtempSync(join(tmpdir(), 'attach-tool-')));
writeFileSync(join(work, 'notes.md'), '# Notes');
writeFileSync(join(work, 'data.csv'), 'a,b');

afterAll(() => rmSync(work, { recursive: true, force: true }));

const uploads = () =>
  vi.fn((_blob: Blob, fileName: string, _ticket?: string) =>
    Promise.resolve(attachment({ id: `a-${fileName}`, fileName })),
  );

describe('attach_file', () => {
  it('uploads each file to the ticket, in order, with its type', async () => {
    const uploadAttachment = uploads();
    const reply = await run(attachFile, fakeClient({ uploadAttachment }), {
      ticket: 'mob-3',
      paths: [join(work, 'notes.md'), join(work, 'data.csv')],
    });
    expect(
      uploadAttachment.mock.calls.map(([blob, name, ticket]) => [blob.type, name, ticket]),
    ).toEqual([
      ['text/markdown', 'notes.md', 'MOB-3'],
      ['text/csv', 'data.csv', 'MOB-3'],
    ]);
    expect(reply.text).toBe('Attached notes.md and data.csv to MOB-3.');
  });

  it('with a comment, uploads the files first and adds them to a new comment', async () => {
    const uploadAttachment = uploads();
    const comment = activity({ id: 'c-1', text: 'The draft' });
    const addComment = vi.fn(returns(comment));
    const reply = await run(attachFile, fakeClient({ uploadAttachment, addComment }), {
      ticket: 'MOB-3',
      paths: [join(work, 'notes.md')],
      comment: ' The draft ',
    });
    expect(uploadAttachment).toHaveBeenCalledWith(expect.any(Blob), 'notes.md', undefined);
    expect(addComment).toHaveBeenCalledWith('MOB-3', {
      text: 'The draft',
      attachmentIds: ['a-notes.md'],
    });
    expect(reply).toEqual({ text: 'Added a comment with notes.md to MOB-3.', data: comment });
  });

  it('sends nothing when one file is outside the allowed folders', async () => {
    const uploadAttachment = uploads();
    const paths = [join(work, 'notes.md'), '/etc/hosts'];
    await expect(
      run(attachFile, fakeClient({ uploadAttachment }), { ticket: 'MOB-3', paths }),
    ).rejects.toThrow("Can't attach /etc/hosts: only files in this folder or a temp folder");
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it('needs one to twenty files', () => {
    const input = (count: number) => ({ ticket: 'MOB-3', paths: Array(count).fill('a.md') });
    expect(attachFile.input.safeParse(input(0)).success).toBe(false);
    expect(attachFile.input.safeParse(input(20)).success).toBe(true);
    expect(attachFile.input.safeParse(input(21)).success).toBe(false);
  });
});

describe('nameList', () => {
  it('joins names the way the replies read', () => {
    expect(nameList(['a.md'])).toBe('a.md');
    expect(nameList(['a.md', 'b.csv'])).toBe('a.md and b.csv');
    expect(nameList(['a.md', 'b.csv', 'c.png'])).toBe('a.md, b.csv and c.png');
  });
});
