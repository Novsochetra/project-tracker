import { describe, expect, it, vi } from 'vitest';
import { MAX_TEXT_CHARS, TEXT_BUDGET_CHARS } from '../../src/format/attachments';
import { loadTextFiles } from '../../src/tools/textFiles';
import { fakeClient, rejectWith } from '../fakeClient';
import { attachment } from '../fixtures';

const textFile = (id: string) =>
  attachment({ id, fileName: `${id}.log`, mimeType: 'text/plain', width: null, height: null });

const serving = (texts: Record<string, string>) =>
  vi.fn((id: string) => Promise.resolve(texts[id] ?? ''));

describe('loadTextFiles', () => {
  it('reads each text file in order', async () => {
    const fetchAttachmentText = serving({ a: 'text of a', b: 'text of b' });
    const texts = await loadTextFiles(fakeClient({ fetchAttachmentText }), [
      textFile('a'),
      textFile('b'),
    ]);
    expect(fetchAttachmentText.mock.calls).toEqual([['a'], ['b']]);
    expect(Object.fromEntries(texts)).toEqual({
      a: { status: 'shown', text: 'text of a', fullLength: 9 },
      b: { status: 'shown', text: 'text of b', fullLength: 9 },
    });
  });

  it('cuts a file after 20,000 characters without splitting one', async () => {
    expect(MAX_TEXT_CHARS).toBe(20_000);
    const long = `${'a'.repeat(19_999)}📄${'b'.repeat(100)}`;
    const client = fakeClient({ fetchAttachmentText: serving({ a: long }) });
    const texts = await loadTextFiles(client, [textFile('a')]);
    expect(texts.get('a')).toEqual({
      status: 'shown',
      text: 'a'.repeat(19_999),
      fullLength: long.length,
    });
  });

  it('cuts at the end of the last whole line that fits, when there is one', async () => {
    const lines = Array.from({ length: 3000 }, (_, index) => `log line ${index}\n`).join('');
    const client = fakeClient({ fetchAttachmentText: serving({ a: lines }) });
    const shown = (await loadTextFiles(client, [textFile('a')])).get('a');
    const text = shown?.status === 'shown' ? shown.text : '';
    expect(text.length).toBeLessThanOrEqual(MAX_TEXT_CHARS);
    expect(text.length).toBeGreaterThan(MAX_TEXT_CHARS - 20);
    expect(text.endsWith('\n')).toBe(true);
    expect(lines.startsWith(text)).toBe(true);
  });

  it('shows 40,000 characters of text in all, and the rest only as links', async () => {
    expect(TEXT_BUDGET_CHARS).toBe(40_000);
    const fetchAttachmentText = serving({
      a: 'a'.repeat(15_000),
      b: 'b'.repeat(30_000),
      c: 'c'.repeat(10_000),
      d: 'd',
    });
    const files = ['a', 'b', 'c', 'd'].map(textFile);
    const texts = await loadTextFiles(fakeClient({ fetchAttachmentText }), files);
    const shownLengths = [...texts.values()].map((text) =>
      text.status === 'shown' ? text.text.length : 0,
    );
    // 15,000 whole, 20,000 (the most for one file), the 5,000 left, then nothing.
    expect(shownLengths).toEqual([15_000, 20_000, 5_000, 0]);
    expect(texts.get('d')).toEqual({ status: 'skipped' });
    expect(fetchAttachmentText).toHaveBeenCalledTimes(3);
  });

  it('notes a file that fails to load and goes on', async () => {
    const fetchAttachmentText = vi
      .fn()
      .mockImplementationOnce(rejectWith(404, 'not_found', 'Attachment was not found.'))
      .mockResolvedValueOnce('fine');
    const texts = await loadTextFiles(fakeClient({ fetchAttachmentText }), [
      textFile('gone'),
      textFile('ok'),
    ]);
    expect(Object.fromEntries(texts)).toEqual({
      gone: { status: 'failed', error: 'Attachment was not found.' },
      ok: { status: 'shown', text: 'fine', fullLength: 4 },
    });
  });
});
