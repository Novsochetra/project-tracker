import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_KINDS,
  ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_NEW_ATTACHMENTS,
  PENDING_ATTACHMENT_TTL_MS,
  UNSUPPORTED_ATTACHMENT_MESSAGE,
  attachmentKind,
  checkAttachment,
  resolveAttachmentType,
  storedExtension,
  tooLargeMessage,
  tooManyFilesMessage,
  typeFromFileName,
} from '../src/domain/attachment';

const MB = 1024 * 1024;

describe('the attachment table', () => {
  it('gives every allowed type a kind and the extension files are stored with', () => {
    const rows = Object.entries(ATTACHMENT_TYPES).map(([type, row]) => [
      type,
      row.kind,
      storedExtension(type as keyof typeof ATTACHMENT_TYPES),
    ]);
    expect(rows).toEqual([
      ['image/png', 'image', 'png'],
      ['image/jpeg', 'image', 'jpg'],
      ['image/gif', 'image', 'gif'],
      ['image/webp', 'image', 'webp'],
      ['image/heic', 'image', 'heic'],
      ['image/heif', 'image', 'heif'],
      ['video/mp4', 'video', 'mp4'],
      ['video/quicktime', 'video', 'mov'],
      ['video/webm', 'video', 'webm'],
      ['text/plain', 'text', 'txt'],
      ['text/markdown', 'text', 'md'],
      ['text/csv', 'text', 'csv'],
      ['application/json', 'text', 'json'],
      ['application/pdf', 'pdf', 'pdf'],
    ]);
  });

  it('limits each kind, and the largest limit caps every upload', () => {
    expect(ATTACHMENT_KINDS.image.maxBytes).toBe(15 * MB);
    expect(ATTACHMENT_KINDS.video.maxBytes).toBe(100 * MB);
    expect(ATTACHMENT_KINDS.text.maxBytes).toBe(5 * MB);
    expect(ATTACHMENT_KINDS.pdf.maxBytes).toBe(25 * MB);
    expect(MAX_ATTACHMENT_BYTES).toBe(100 * MB);
  });

  it('never allows types that can run script when opened', () => {
    for (const type of ['image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/xml']) {
      expect(type in ATTACHMENT_TYPES, type).toBe(false);
    }
  });

  it('keeps an upload that no ticket or comment uses for a day', () => {
    expect(PENDING_ATTACHMENT_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('attachmentKind', () => {
  it('finds the kind of each allowed type', () => {
    expect(attachmentKind('image/png')).toBe('image');
    expect(attachmentKind('video/quicktime')).toBe('video');
    expect(attachmentKind('text/markdown')).toBe('text');
    expect(attachmentKind('application/json')).toBe('text');
    expect(attachmentKind('application/pdf')).toBe('pdf');
  });

  it('ignores case and parameters', () => {
    expect(attachmentKind('Text/Plain; charset=UTF-8')).toBe('text');
    expect(attachmentKind(' VIDEO/MP4 ')).toBe('video');
  });

  it('has no kind for other types', () => {
    for (const type of ['image/svg+xml', 'text/html', 'application/zip', '', 'constructor']) {
      expect(attachmentKind(type), type).toBeNull();
    }
  });
});

describe('typeFromFileName', () => {
  it('maps every extension in the table, in any case', () => {
    expect(typeFromFileName('server.log')).toBe('text/plain');
    expect(typeFromFileName('notes.TXT')).toBe('text/plain');
    expect(typeFromFileName('README.md')).toBe('text/markdown');
    expect(typeFromFileName('export.csv')).toBe('text/csv');
    expect(typeFromFileName('config.json')).toBe('application/json');
    expect(typeFromFileName('IMG_0001.HEIC')).toBe('image/heic');
    expect(typeFromFileName('photo.jpeg')).toBe('image/jpeg');
    expect(typeFromFileName('photo.jpg')).toBe('image/jpeg');
    expect(typeFromFileName('clip.MOV')).toBe('video/quicktime');
    expect(typeFromFileName('spec.final.pdf')).toBe('application/pdf');
  });

  it('knows nothing about other names', () => {
    for (const name of ['logo.svg', 'page.html', 'archive.zip', 'Makefile', 'log', '.md.', '']) {
      expect(typeFromFileName(name), name).toBeNull();
    }
  });
});

describe('resolveAttachmentType', () => {
  it('keeps an allowed type the browser gives, whatever the name says', () => {
    expect(resolveAttachmentType('image/png', 'shot.jpg')).toBe('image/png');
    expect(resolveAttachmentType('text/plain; charset=utf-8', 'server.log')).toBe('text/plain');
    expect(resolveAttachmentType('video/quicktime', 'IMG_0002.MOV')).toBe('video/quicktime');
  });

  it('lets the name decide when the browser gives no type or a generic one', () => {
    expect(resolveAttachmentType('', 'server.log')).toBe('text/plain');
    expect(resolveAttachmentType('application/octet-stream', 'README.md')).toBe('text/markdown');
    expect(resolveAttachmentType('', 'IMG_0001.HEIC')).toBe('image/heic');
    expect(resolveAttachmentType('text/x-markdown', 'notes.md')).toBe('text/markdown');
  });

  it('takes the other names systems give allowed types, whatever the name', () => {
    expect(resolveAttachmentType('text/x-log', 'server.log')).toBe('text/plain');
    expect(resolveAttachmentType('text/x-csv', 'export.csv')).toBe('text/csv');
    expect(resolveAttachmentType('application/csv', 'export.csv')).toBe('text/csv');
    expect(resolveAttachmentType('text/comma-separated-values', 'a.csv')).toBe('text/csv');
    expect(resolveAttachmentType('image/jpg', 'IMG_0003.JPG')).toBe('image/jpeg');
    expect(checkAttachment({ type: 'text/x-log', name: 'server.log', size: 10 })).toEqual({
      ok: true,
      mimeType: 'text/plain',
      kind: 'text',
    });
  });

  it('reads CSV files that Windows labels as Excel files by their name', () => {
    expect(resolveAttachmentType('application/vnd.ms-excel', 'export.csv')).toBe('text/csv');
    expect(resolveAttachmentType('application/vnd.ms-excel', 'budget.xls')).toBeNull();
  });

  it('refuses SVG, HTML and unknown types, even with an allowed name', () => {
    expect(resolveAttachmentType('image/svg+xml', 'logo.svg')).toBeNull();
    expect(resolveAttachmentType('image/svg+xml', 'logo.png')).toBeNull();
    expect(resolveAttachmentType('text/html', 'page.html')).toBeNull();
    expect(resolveAttachmentType('text/html', 'notes.txt')).toBeNull();
    expect(resolveAttachmentType('application/zip', 'logs.zip')).toBeNull();
    expect(resolveAttachmentType('application/octet-stream', 'tool.exe')).toBeNull();
    expect(resolveAttachmentType('', 'page.html')).toBeNull();
  });
});

describe('checkAttachment', () => {
  const file = (type: string, name: string, size = 10) => ({ type, name, size });

  it('accepts a file of an allowed type within its kind limit', () => {
    expect(checkAttachment(file('video/mp4', 'demo.mp4', 16 * MB))).toEqual({
      ok: true,
      mimeType: 'video/mp4',
      kind: 'video',
    });
    expect(checkAttachment(file('application/octet-stream', 'crash.log'))).toEqual({
      ok: true,
      mimeType: 'text/plain',
      kind: 'text',
    });
  });

  it('applies the limit of the kind, up to and including it', () => {
    expect(checkAttachment(file('image/png', 'a.png', 15 * MB)).ok).toBe(true);
    expect(checkAttachment(file('image/png', 'a.png', 15 * MB + 1))).toEqual({
      ok: false,
      message: 'Images can be up to 15 MB.',
    });
    expect(checkAttachment(file('text/csv', 'a.csv', 5 * MB + 1))).toEqual({
      ok: false,
      message: 'Text files can be up to 5 MB.',
    });
    expect(checkAttachment(file('application/pdf', 'a.pdf', 25 * MB + 1))).toEqual({
      ok: false,
      message: 'PDFs can be up to 25 MB.',
    });
    expect(checkAttachment(file('video/webm', 'a.webm', 100 * MB + 1))).toEqual({
      ok: false,
      message: 'Videos can be up to 100 MB.',
    });
  });

  it('says what can be attached when the type is not allowed', () => {
    expect(checkAttachment(file('image/svg+xml', 'logo.svg'))).toEqual({
      ok: false,
      message: UNSUPPORTED_ATTACHMENT_MESSAGE,
    });
  });
});

describe('messages', () => {
  it('name the limit of each kind', () => {
    expect(tooLargeMessage('image')).toBe('Images can be up to 15 MB.');
    expect(tooLargeMessage('video')).toBe('Videos can be up to 100 MB.');
    expect(tooLargeMessage('text')).toBe('Text files can be up to 5 MB.');
    expect(tooLargeMessage('pdf')).toBe('PDFs can be up to 25 MB.');
  });

  it('say how many files a new ticket or comment can have', () => {
    expect(MAX_NEW_ATTACHMENTS).toBe(20);
    expect(tooManyFilesMessage('ticket')).toBe('A new ticket can have up to 20 files.');
    expect(tooManyFilesMessage('comment')).toBe('A comment can have up to 20 files.');
    expect(tooManyFilesMessage('question')).toBe('A question can have up to 20 files.');
  });

  it('list everything that can be attached', () => {
    expect(UNSUPPORTED_ATTACHMENT_MESSAGE).toBe(
      'Only images (PNG, JPEG, GIF, WebP, HEIC), videos (MP4, MOV, WebM), text files ' +
        '(TXT, LOG, MD, CSV, JSON) and PDFs can be attached.',
    );
  });
});

describe('ATTACHMENT_ACCEPT', () => {
  const accepted = ATTACHMENT_ACCEPT.split(',');

  it('lists every type and extension but HEIC and HEIF for file inputs, JPEG first', () => {
    expect(ATTACHMENT_ACCEPT).toBe(
      'image/jpeg,image/png,image/gif,image/webp,' +
        'video/mp4,video/quicktime,video/webm,' +
        'text/plain,text/markdown,text/csv,application/json,application/pdf,' +
        '.jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm,' +
        '.txt,.log,.md,.csv,.json,.pdf',
    );
  });

  // iOS Safari converts a picked photo to the first type listed unless the list takes its HEIC.
  it('starts with JPEG, so an iPhone sends a picked photo as JPEG', () => {
    expect(accepted[0]).toBe('image/jpeg');
  });

  // Listed, HEIC would arrive as it is, which the server can neither shrink nor strip of its GPS.
  it('leaves HEIC and HEIF out in every spelling', () => {
    expect(accepted.filter((entry) => /heic|heif/i.test(entry))).toEqual([]);
  });

  it('keeps every other type and extension', () => {
    const others = Object.entries(ATTACHMENT_TYPES).filter(([, { kind }]) => kind !== 'image');
    for (const [type, { extensions }] of others) {
      expect(accepted, type).toContain(type);
      for (const extension of extensions) expect(accepted, type).toContain(`.${extension}`);
    }
    for (const type of ['image/png', 'image/gif', 'image/webp']) expect(accepted).toContain(type);
  });

  it('still takes a HEIC that arrives some other way, such as dropped on a Mac', () => {
    const photo = { type: 'image/heic', name: 'IMG_0006.HEIC', size: 3 * MB };
    expect(checkAttachment(photo)).toEqual({ ok: true, mimeType: 'image/heic', kind: 'image' });
  });
});
