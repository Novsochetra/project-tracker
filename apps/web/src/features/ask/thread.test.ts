import { describe, expect, it } from 'vitest';
import { makeAskRun, makeChatDetail, makeMessage } from '../../api/test/chatFixtures';
import { stoppedRunsOf, threadItems, type ThreadItem } from './thread';

const question = (id: string, at: number) => makeMessage({ id, createdAt: at });
const answer = (id: string, at: number) => makeMessage({ id, role: 'claude', createdAt: at });
const stopped = (id: string, at: number) =>
  makeAskRun({ id, status: 'cancelled', createdAt: at, endedAt: at + 500, stepCount: 2 });
const ids = (items: ThreadItem[]) =>
  items.map((item) => (item.kind === 'message' ? item.message.id : item.run.id));

describe('threadItems', () => {
  it('puts each stopped question right after its question, before what was asked later', () => {
    const messages = [question('q1', 1_000), question('q2', 3_000), answer('a2', 4_000)];
    expect(ids(threadItems(messages, [stopped('r1', 1_000)]))).toEqual(['q1', 'r1', 'q2', 'a2']);
  });

  it('keeps several stopped questions in order, also a last one with nothing after it', () => {
    const messages = [question('q1', 1_000), question('q2', 3_000), question('q3', 5_000)];
    const runs = [stopped('r3', 5_000), stopped('r1', 1_000)];
    expect(ids(threadItems(messages, runs))).toEqual(['q1', 'r1', 'q2', 'q3', 'r3']);
  });

  it('is the messages alone when nothing stopped', () => {
    expect(ids(threadItems([question('q1', 1_000), answer('a1', 2_000)], []))).toEqual([
      'q1',
      'a1',
    ]);
  });
});

describe('stoppedRunsOf', () => {
  it("adds the latest question's end before the chat is read again, once", () => {
    const old = stopped('r1', 1_000);
    const latest = stopped('r2', 3_000);
    expect(stoppedRunsOf(makeChatDetail({ run: latest, stoppedRuns: [old] }))).toEqual([
      old,
      latest,
    ]);
    expect(
      stoppedRunsOf(
        makeChatDetail({ run: latest, stoppedRuns: [old, { ...latest, stepCount: 1 }] }),
      ),
    ).toEqual([old, latest]);
  });

  it('adds no latest question that is working, answered or took no steps', () => {
    const old = stopped('r1', 1_000);
    for (const run of [
      makeAskRun({ status: 'running' }),
      makeAskRun({ status: 'done', stepCount: 3 }),
      makeAskRun({ status: 'failed', stepCount: 0 }),
    ]) {
      expect(stoppedRunsOf(makeChatDetail({ run, stoppedRuns: [old] }))).toEqual([old]);
    }
    expect(stoppedRunsOf(null)).toEqual([]);
  });
});
