import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_ASK_OPTIONS, type AskMode } from '@tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeChatDetail } from '../../src/api/test/chatFixtures';
import { makeRunner } from '../../src/api/test/runFixtures';
import { askOptionsHint, MODE_OPTIONS } from '../../src/features/ask/askOptions';
import { renderAsk } from '../../src/features/ask/test/renderAsk';

let restore: () => void;

beforeEach(() => {
  localStorage.clear();
  restore = () => {};
});
afterEach(() => restore());

const hintOf = (mode: AskMode) => askOptionsHint({ ...DEFAULT_ASK_OPTIONS, mode });

// PT-202: only Edit had a line under the options row, and on a phone it took two lines, so
// switching Ask, Plan and Edit moved the options row up and down. Every mode has one short line;
// the e2e "keeps the options row still" test measures it at 320px.
describe('regression: the mode hint keeps the options row still', () => {
  it('gives every mode its own short hint', () => {
    const hints = MODE_OPTIONS.map(({ value }) => hintOf(value));
    expect(new Set(hints).size).toBe(MODE_OPTIONS.length);
    for (const hint of hints) expect(hint.length).toBeLessThanOrEqual(50);
  });

  it('shows the hint of the mode picked, Ask, Plan or Edit', async () => {
    restore = renderAsk({
      client: {
        getChat: vi.fn().mockResolvedValue(makeChatDetail()),
        listRunners: vi.fn().mockResolvedValue([makeRunner()]),
      },
    }).restore;
    const user = userEvent.setup();
    for (const { value, label } of [...MODE_OPTIONS].reverse()) {
      await user.click(await screen.findByRole('button', { name: label }));
      expect(screen.getByText(hintOf(value))).toBeVisible();
    }
  });
});
