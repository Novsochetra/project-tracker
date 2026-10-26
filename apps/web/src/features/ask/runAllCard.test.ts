import type { BatchTicket, ChatMessage } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { makeMessage } from '../../api/test/chatFixtures';
import {
  batchCountsText,
  batchEndText,
  limitText,
  messageRunAllCards,
  skippedLines,
} from './runAllCard';

const CARD = 'Ready:\n```run-all\nlimit: 3\n```\nTap Confirm.';
let next = 0;
const message = (role: ChatMessage['role'], text: string, batchRunId: string | null = null) => {
  next += 1;
  return makeMessage({ id: `m-${next}`, role, text, batchRunId });
};
const preview = { tickets: [], skippedActive: 0, skippedDevice: 0, leftOver: 0, maxParallel: null };
const ticket = (state: BatchTicket['state'], num: number): BatchTicket => ({
  runId: `r-${num}`,
  ticketKey: `MOB-${num}`,
  ticketTitle: 'Sync',
  state,
});

describe('messageRunAllCards', () => {
  it('splits a Claude card into the text around it and its limit', () => {
    const answer = message('claude', CARD);
    expect(messageRunAllCards([answer]).get(answer.id)).toEqual({
      split: { before: 'Ready:', limit: 3, after: 'Tap Confirm.' },
      replaced: false,
    });
  });

  it('marks older unconfirmed cards as replaced, but keeps a confirmed one', () => {
    const first = message('claude', CARD);
    const started = message('claude', CARD, 'r-batch');
    const latest = message('claude', CARD);
    const cards = messageRunAllCards([first, started, latest]);
    expect(cards.get(first.id)?.replaced).toBe(true);
    expect(cards.get(started.id)?.replaced).toBe(false);
    expect(cards.get(latest.id)?.replaced).toBe(false);
  });

  it('leaves a card the person pasted as text', () => {
    expect(messageRunAllCards([message('person', CARD)]).size).toBe(0);
  });
});

describe('Run all card text', () => {
  it('shows the card limit, else that Claude decides', () => {
    expect(limitText(3)).toBe('3 at a time');
    expect(limitText(null)).toBe('Claude decides how many at a time');
  });

  it('names what Run all leaves out', () => {
    expect(skippedLines(preview)).toEqual([]);
    expect(skippedLines({ ...preview, skippedActive: 1, skippedDevice: 1 })).toEqual([
      '1 already running or waiting',
      '1 needs a device',
    ]);
    expect(skippedLines({ ...preview, skippedDevice: 2 })).toEqual(['2 need a device']);
    expect(skippedLines({ ...preview, leftOver: 4 })).toEqual(['4 more wait for the next Run all']);
  });

  it('counts the batch tickets by state', () => {
    const tickets = [ticket('running', 1), ticket('waiting', 2), ticket('done', 3)];
    expect(batchCountsText(tickets)).toBe('1 running · 1 waiting · 1 done · 0 failed');
    expect(batchCountsText([ticket('cancelled', 4)])).toBe(
      '0 running · 0 waiting · 0 done · 0 failed · 1 cancelled',
    );
  });

  it('says when the batch ended', () => {
    expect(batchEndText('running')).toBeNull();
    expect(batchEndText('queued')).toBeNull();
    expect(batchEndText('done')).toBe('Finished');
    expect(batchEndText('cancelled')).toBe('Stopped');
    expect(batchEndText('failed')).toBe('Failed');
  });
});
