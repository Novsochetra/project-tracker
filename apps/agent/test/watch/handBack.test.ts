import { ApiError } from '@tracker/client';
import { describe, expect, it, vi } from 'vitest';
import { handBackReport } from '../../src/watch/report/handBack';
import { fakeTracker, job, reportEntry } from './fakeTracker';

const REPORT = ['TICKET: MOB-1', 'STATUS: done', 'SUMMARY: Fixed it.'].join('\n');
const OUTPUT = `Read the ticket and fixed it.\n\n\`\`\`\n${REPORT}\n\`\`\`\n`;

function handBack(tracker: ReturnType<typeof fakeTracker>, output: string) {
  const log: string[] = [];
  const deps = { api: tracker.api, log: (text: string) => log.push(text), describe: String };
  return { log, done: handBackReport(deps, job('r-1', 'MOB-1'), [output]) };
}

describe('putting Claude’s report on the ticket', () => {
  it('sends the block the way “Paste report” does', async () => {
    const tracker = fakeTracker([]);
    const { log, done } = handBack(tracker, OUTPUT);
    await done;
    expect(tracker.reports).toEqual([{ text: REPORT, ticketKey: 'MOB-1' }]);
    expect(log).toEqual(["Put Claude's report on MOB-1."]);
  });

  it("takes the last turn's report, without the words of the turns after it", async () => {
    const tracker = fakeTracker([]);
    const log: string[] = [];
    const deps = { api: tracker.api, log: (text: string) => log.push(text), describe: String };
    await handBackReport(deps, job('r-1', 'MOB-1'), [OUTPUT, 'The sub agent agreed.']);
    expect(tracker.reports).toEqual([{ text: REPORT, ticketKey: 'MOB-1' }]);
  });

  it('sends nothing when the output has no report block', async () => {
    const tracker = fakeTracker([]);
    const { log, done } = handBack(tracker, 'All done, I changed two files.');
    await done;
    expect(tracker.reports).toEqual([]);
    expect(tracker.api.getTicket).not.toHaveBeenCalled();
    expect(log).toEqual([]);
  });

  it('leaves the ticket alone when Claude submitted through the tools', async () => {
    const tracker = fakeTracker([]);
    tracker.activity.push(reportEntry(5));
    const { log, done } = handBack(tracker, OUTPUT);
    await done;
    expect(tracker.reports).toEqual([]);
    expect(log).toEqual([]);
  });

  it('still sends it when the only report on the ticket is older than the run', async () => {
    const tracker = fakeTracker([]);
    tracker.activity.push(reportEntry(1));
    await handBack(tracker, OUTPUT).done;
    expect(tracker.reports).toHaveLength(1);
  });

  it('says so when the tracker refuses the report', async () => {
    const tracker = fakeTracker([]);
    const refused = new ApiError(400, 'no_match', 'No matching ticket found.');
    const api = { ...tracker.api, applyReport: vi.fn(() => Promise.reject(refused)) };
    const { log, done } = handBack({ ...tracker, api }, OUTPUT);
    await done;
    expect(log).toEqual([`Couldn't put Claude's report on MOB-1: ${String(refused)}`]);
  });
});
