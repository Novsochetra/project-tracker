import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError } from '@tracker/client';
import type { ProjectDetail } from '@tracker/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { listItem, project, STATUS, statuses } from '../../src/api/test/fixtures';
import { renderWithApp } from '../../src/app/test/harness';
import { readyItems } from '../../src/features/ready/readyItems';
import { ReadySection } from '../../src/features/ready/ReadySection';
import { color, contrast } from './contrast';

const toastWith = (text: string) => screen.getByText(text, { exact: true }).parentElement;

describe('regression: a failure toast looks like a failure, not a success', () => {
  it('shows the error icon when a move to Done is refused, and the check for the move itself', async () => {
    const user = userEvent.setup();
    const detail: ProjectDetail = { project, statuses };
    let refuse: (error: Error) => void = () => undefined;
    renderWithApp(
      <ReadySection items={readyItems([listItem(3, STATUS.reviewed, 0)], [project])} />,
      {
        client: {
          getProject: vi.fn().mockResolvedValue(detail),
          updateTicket: vi.fn(() => new Promise((_resolve, reject) => (refuse = reject))),
        },
      },
    );
    await user.click(await screen.findByRole('button', { name: 'Move MOB-3 to Done' }));
    const moved = toastWith('MOB-3 moved to Done');
    expect(moved?.querySelector('svg')).toHaveClass('lucide-circle-check');

    refuse(new ApiError(409, 'conflict', 'MOB-3 changed meanwhile.'));
    await waitFor(() => expect(toastWith('MOB-3 changed meanwhile.')).toBeTruthy());
    const failed = toastWith('MOB-3 changed meanwhile.');
    expect(failed?.querySelector('svg')).toHaveClass('lucide-circle-alert');
    expect(failed?.querySelector('svg')).not.toHaveClass('lucide-circle-check');
  });

  it('draws the error icon in a red that keeps 3:1 (WCAG 1.4.11) on the toast', () => {
    expect(contrast(color('--danger-inverse'), color('--ink'))).toBeGreaterThanOrEqual(3);
  });
});

const SOURCE = join(import.meta.dirname, '../../src');
// Messages that only ever say something failed.
const FAILURE = /errorMessage\(|NETWORK_ERROR_MESSAGE|droppedToast\(|isn't saved/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

// The text of each `show(…)` call, up to its closing parenthesis.
function showCalls(code: string): string[] {
  return [...code.matchAll(/\bshow\(/g)].map(({ index }) => {
    let depth = 0;
    for (let at = index + 'show'.length; at < code.length; at += 1) {
      if (code[at] === '(') depth += 1;
      if (code[at] === ')') depth -= 1;
      if (depth === 0) return code.slice(index, at + 1);
    }
    return code.slice(index);
  });
}

describe('regression: every failure toast in the app is an error toast', () => {
  const calls = sourceFiles(SOURCE).flatMap((file) =>
    showCalls(readFileSync(file, 'utf8')).map((call) => ({ file, call })),
  );

  it('finds the failure toasts it checks', () => {
    expect(calls.filter(({ call }) => FAILURE.test(call)).length).toBeGreaterThanOrEqual(10);
  });

  it('passes the error kind with every failure message', () => {
    const plain = calls.filter(({ call }) => FAILURE.test(call) && !call.includes("kind: 'error'"));
    expect(plain.map(({ file, call }) => `${file.slice(SOURCE.length)}: ${call}`)).toEqual([]);
  });
});
