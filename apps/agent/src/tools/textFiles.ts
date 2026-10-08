import type { Attachment } from '@tracker/shared';
import type { TrackerApi } from '../client';
import { describeError } from '../errors';
import { MAX_TEXT_CHARS, TEXT_BUDGET_CHARS, type TextFile } from '../format/attachments';

const ENDS_IN_HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

// Ending on a whole line keeps a cut log readable; without a line break in the second half,
// the cut stays put but never between the two halves of an emoji.
function cut(text: string, max: number): string {
  if (text.length <= max) return text;
  const part = text.slice(0, max);
  const lineEnd = part.lastIndexOf('\n');
  if (lineEnd >= max / 2) return part.slice(0, lineEnd + 1);
  return ENDS_IN_HIGH_SURROGATE.test(part) ? part.slice(0, -1) : part;
}

async function loadText(client: TrackerApi, file: Attachment, room: number): Promise<TextFile> {
  try {
    const text = await client.fetchAttachmentText(file.id);
    return {
      status: 'shown',
      text: cut(text, Math.min(MAX_TEXT_CHARS, room)),
      fullLength: text.length,
    };
  } catch (error) {
    return { status: 'failed', error: describeError(error) };
  }
}

/** Reads the text files in order until TEXT_BUDGET_CHARS are shown; the rest are only linked. */
export async function loadTextFiles(
  client: TrackerApi,
  files: readonly Attachment[],
): Promise<Map<string, TextFile>> {
  const texts = new Map<string, TextFile>();
  let room = TEXT_BUDGET_CHARS;
  for (const file of files) {
    const text: TextFile = room > 0 ? await loadText(client, file, room) : { status: 'skipped' };
    if (text.status === 'shown') room -= text.text.length;
    texts.set(file.id, text);
  }
  return texts;
}
