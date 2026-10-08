import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { attachment, comment, makeTicketDetail } from '../../src/api/test/fixtures';
import { renderTicket } from '../../src/features/ticket/test/renderTicket';
import { skipAnimations } from '../../src/overlays/testing';

let cleanups: Array<() => void> = [];

beforeEach(() => {
  cleanups = [skipAnimations()];
});

afterEach(() => {
  cleanups.forEach((undo) => undo());
});

const files = (owner: string, activityId: string | null) => [
  attachment(`${owner}-v`, {
    activityId,
    fileName: 'crash.mov',
    mimeType: 'video/quicktime',
    width: null,
    height: null,
  }),
  attachment(`${owner}-p`, {
    activityId,
    fileName: 'spec.pdf',
    mimeType: 'application/pdf',
    size: 1_258_291,
    width: null,
    height: null,
  }),
  attachment(`${owner}-t`, {
    activityId,
    fileName: 'server.log',
    mimeType: 'text/plain',
    size: 2048,
    width: null,
    height: null,
  }),
];

// Every thumbnail was an <img> of its file, so a video, PDF or text file an agent attached to a
// ticket or a comment showed as a broken image.
it('shows videos, PDFs and text files as their own tiles, never as broken images', () => {
  const rendered = renderTicket({
    detail: makeTicketDetail(undefined, {
      attachments: [...files('ticket', null), ...files('comment', 'c1')],
      activity: [comment('c1', 'Logs attached', { attachments: files('comment', 'c1') })],
    }),
  });
  cleanups.push(rendered.restorePhone);

  expect(document.querySelectorAll('img[src*="/api/attachments/"]')).toHaveLength(0);
  expect(screen.getAllByRole('button', { name: 'Play video 1' })).toHaveLength(2);
  const pdfs = screen.getAllByRole('link', { name: 'Open spec.pdf' });
  expect(pdfs.map((link) => link.getAttribute('href'))).toEqual([
    '/api/attachments/ticket-p/file',
    '/api/attachments/comment-p/file',
  ]);
  expect(pdfs[0]).toHaveTextContent('1.2 MB');
  const texts = screen.getAllByRole('button', { name: 'Open server.log' });
  expect(texts).toHaveLength(2);
  expect(texts[0]).toHaveTextContent('2 KB');
  const log = within(screen.getByRole('region', { name: 'Activity' }));
  expect(log.getByRole('link', { name: 'Open spec.pdf' })).toBe(pdfs[1]);
});
