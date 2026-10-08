import { describe, expect, it } from 'vitest';
import { reportSections } from './reportSections';

const lines = (...parts: string[]) => parts.join('\n');

describe('reportSections', () => {
  it('reads a submission written by submit_for_review', () => {
    const text = lines(
      'TICKET: MOB-3',
      'STATUS: done',
      'SUMMARY: Fixed the rotation crash.',
      'FILES: src/profile/Header.tsx, src/profile/Header.test.tsx',
      'NEXT: Check on a real device in landscape',
    );
    expect(reportSections(text)).toEqual({
      status: { category: 'in_review', text: 'done' },
      summary: 'Fixed the rotation crash.',
      files: ['src/profile/Header.tsx', 'src/profile/Header.test.tsx'],
      next: 'Check on a real device in landscape',
    });
  });

  it('keeps a summary’s lines and reads files one per line', () => {
    const text = lines(
      'TICKET: PT-23',
      'STATUS: done',
      'SUMMARY: Projects shows a Ready for you card.',
      '',
      'Verified: tests first; e2e 18/18.',
      'FILES: packages/shared/src/domain/ticket.ts',
      'apps/web/src/features/ready/ReadyRow.tsx',
      'NEXT: PT-25: the review card.',
      'Optional: sidebar counts.',
    );
    expect(reportSections(text)).toMatchObject({
      summary: 'Projects shows a Ready for you card.\n\nVerified: tests first; e2e 18/18.',
      files: ['packages/shared/src/domain/ticket.ts', 'apps/web/src/features/ready/ReadyRow.tsx'],
      next: 'PT-25: the review card.\nOptional: sidebar counts.',
    });
  });

  it('leaves out files and next steps that say none', () => {
    const sections = reportSections(
      lines(
        'TICKET: MOB-4',
        'STATUS: done',
        'SUMMARY: Added dark mode.',
        'FILES: none',
        'NEXT: None.',
      ),
    );
    expect(sections).toMatchObject({ files: [], next: null });
    expect(reportSections(lines('SUMMARY: Only a summary.'))).toEqual({
      status: null,
      summary: 'Only a summary.',
      files: [],
      next: null,
    });
  });

  it('reads pasted reports with Markdown around the labels and file names', () => {
    const text = lines(
      'TICKET: MOB-1',
      '**STATUS:** done',
      '- **Summary**: Added the inline error.',
      '**FILES:**',
      '- `src/login/LoginForm.tsx`',
      '- `src/login/my_errors.ts`',
      '> NEXT: Ask design about the copy',
    );
    expect(reportSections(text)).toEqual({
      status: { category: 'in_review', text: 'done' },
      summary: 'Added the inline error.',
      files: ['src/login/LoginForm.tsx', 'src/login/my_errors.ts'],
      next: 'Ask design about the copy',
    });
  });

  it('keeps code marks that start a value', () => {
    const text = lines(
      '**SUMMARY:** `useAuth` retries once.',
      '**FILES:** `src/auth/useAuth.ts`, `src/auth/useAuth.test.ts`',
      '`NEXT:` none',
    );
    expect(reportSections(text)).toMatchObject({
      summary: '`useAuth` retries once.',
      files: ['src/auth/useAuth.ts', 'src/auth/useAuth.test.ts'],
      next: null,
    });
  });

  it('keeps the status words of a report that isn’t finished', () => {
    const text = lines('STATUS: in progress, blocked on API keys', 'SUMMARY: Half of the screens.');
    expect(reportSections(text)?.status).toEqual({
      category: 'in_progress',
      text: 'in progress, blocked on API keys',
    });
    expect(reportSections(lines('STATUS: shipping soon', 'SUMMARY: x'))?.status).toEqual({
      category: null,
      text: 'shipping soon',
    });
  });

  it.each([
    ['no summary', lines('TICKET: MOB-1', 'STATUS: done')],
    ['an empty summary', lines('TICKET: MOB-1', 'SUMMARY:', 'NEXT: none')],
    ['plain text', 'Fixed it, see the PR.'],
    ['text before the fields', lines('Here is what I did:', 'SUMMARY: Fixed it.')],
    ['a repeated field', lines('SUMMARY: One.', 'SUMMARY: Two.')],
    ['two tickets', lines('TICKET: MOB-1', 'SUMMARY: One.', 'TICKET: MOB-2', 'SUMMARY: Two.')],
    ['nothing', ''],
  ])('leaves a report with %s to the raw text', (_case, text) => {
    expect(reportSections(text)).toBeNull();
  });
});
