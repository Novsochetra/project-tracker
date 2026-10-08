import { describe, expect, it } from 'vitest';
import {
  describeAttachment,
  formatAttachments,
  NO_FILE_CONTENT,
  type FileView,
  type TextFile,
} from '../../src/format/attachments';
import { attachment } from '../fixtures';

const FILES = 'http://localhost:4100/api/attachments';

const view = (texts: Record<string, TextFile> = {}): FileView => ({
  texts: new Map(Object.entries(texts)),
  fileUrl: (file) => `${FILES}/${file.id}/file`,
  usesToken: false,
});

const shown = (text: string, fullLength = text.length): TextFile => ({
  status: 'shown',
  text,
  fullLength,
});

const file = (id: string, fileName: string, mimeType: string, size: number) =>
  attachment({
    id,
    fileName,
    mimeType,
    size,
    width: null,
    height: null,
    url: `/api/attachments/${id}/file`,
  });

const log = file('log', 'crash.log', 'text/plain', 2048);
const video = file('vid', 'repro.mov', 'video/quicktime', 50_000_000);
const pdf = file('pdf', 'spec.pdf', 'application/pdf', 1_200_000);

describe('describeAttachment', () => {
  it('shows an image by name, size and dimensions', () => {
    expect(describeAttachment(attachment(), view())).toBe('screenshot.png · 1 KB · 1170×2532');
  });

  it('leaves out unknown dimensions', () => {
    const image = attachment({ width: null, height: null, size: 900 });
    expect(describeAttachment(image, view())).toBe('screenshot.png · 900 B');
  });

  it('gives videos, PDFs and other files their type, size and download URL', () => {
    expect(describeAttachment(video, view())).toBe(
      `repro.mov · video/quicktime · 47.7 MB · ${FILES}/vid/file`,
    );
    expect(describeAttachment(pdf, view())).toBe(
      `spec.pdf · application/pdf · 1.1 MB · ${FILES}/pdf/file`,
    );
    const other = file('zip', 'logs.zip', 'application/zip', 10);
    expect(describeAttachment(other, view())).toBe(
      `logs.zip · application/zip · 10 B · ${FILES}/zip/file`,
    );
  });

  it('gives a text file shown below its type and size', () => {
    expect(describeAttachment(log, view({ log: shown('boom') }))).toBe(
      'crash.log · text/plain · 2 KB',
    );
  });

  it('links a text file that is not shown', () => {
    expect(describeAttachment(log, view())).toBe(
      `crash.log · text/plain · 2 KB · ${FILES}/log/file`,
    );
    expect(describeAttachment(log, view({ log: { status: 'skipped' } }))).toBe(
      `crash.log · text/plain · 2 KB · ${FILES}/log/file ` +
        '(not shown: the 40,000-character limit for text files is used up)',
    );
  });

  it('says when a text file could not be loaded', () => {
    const failed: TextFile = { status: 'failed', error: 'Attachment was not found.' };
    expect(describeAttachment(log, view({ log: failed }))).toBe(
      'crash.log · text/plain · 2 KB · could not be loaded: Attachment was not found.',
    );
  });

  it('uses the relative file URL when no view is given', () => {
    expect(describeAttachment(pdf, NO_FILE_CONTENT)).toBe(
      'spec.pdf · application/pdf · 1.1 MB · /api/attachments/pdf/file',
    );
  });
});

describe('formatAttachments', () => {
  it('lists images as bullet lines', () => {
    const images = [
      attachment(),
      attachment({ fileName: 'b.gif', mimeType: 'image/gif', size: 2048, width: 10, height: 20 }),
    ];
    expect(formatAttachments(images, view())).toEqual([
      '- screenshot.png · 1 KB · 1170×2532',
      '- b.gif · 2 KB · 10×20',
    ]);
  });

  it('lists the files, then the contents of each text file', () => {
    const notes = file('md', 'notes.md', 'text/markdown', 30);
    const texts = view({ log: shown('line one\nline two\n'), md: shown('# Notes') });
    expect(formatAttachments([attachment(), log, video, notes], texts)).toEqual([
      '- screenshot.png · 1 KB · 1170×2532',
      '- crash.log · text/plain · 2 KB',
      `- repro.mov · video/quicktime · 47.7 MB · ${FILES}/vid/file`,
      '- notes.md · text/markdown · 30 B',
      '',
      'Contents of crash.log:\n```\nline one\nline two\n```',
      '',
      'Contents of notes.md:\n```\n# Notes\n```',
    ]);
  });

  it('fences contents with more backticks than they hold', () => {
    const readme = '```ts\nconst a = 1;\n```\nand ````four````';
    expect(formatAttachments([log], view({ log: shown(readme) }))).toEqual([
      '- crash.log · text/plain · 2 KB',
      '',
      `Contents of crash.log:\n\`\`\`\`\`\n${readme}\n\`\`\`\`\``,
    ]);
  });

  it('says where a cut text file goes on', () => {
    expect(formatAttachments([log], view({ log: shown('first part', 54_321) }))).toEqual([
      '- crash.log · text/plain · 2 KB',
      '',
      'Contents of crash.log:\n```\nfirst part\n```\n' +
        `(Cut after 10 of 54,321 characters. The whole file: ${FILES}/log/file)`,
    ]);
  });
});
