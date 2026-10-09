import { describe, expect, it } from 'vitest';
import { callTool } from '../../src/tools/call';
import { listProjects } from '../../src/tools/listProjects';
import { moveTicket } from '../../src/tools/moveTicket';
import { reviewTicket } from '../../src/tools/reviewTicket';
import { fakeClient, rejectWith, returns } from '../fakeClient';
import { detail, projectSummary } from '../fixtures';

const errorResult = (text: string) => ({ content: [{ type: 'text', text }], isError: true });

describe('callTool', () => {
  it('returns the reply text as content', async () => {
    const client = fakeClient({ listProjects: returns([projectSummary()]) });
    expect(await callTool(listProjects, client, {})).toEqual({
      content: [{ type: 'text', text: 'MOB · Mobile app · 3 open, 7 total' }],
    });
  });

  it("turns an API error into an error result with the server's message", async () => {
    const client = fakeClient({
      reviewTicket: rejectWith(409, 'conflict', 'MOB-3 is not waiting for review.'),
    });
    const input = { ticket: 'MOB-3', verdict: 'approved', rating: 5, summary: 'ok' } as const;
    expect(await callTool(reviewTicket, client, input)).toEqual(
      errorResult('MOB-3 is not waiting for review.'),
    );
  });

  it("keeps the server's message when it refuses a change", async () => {
    const client = fakeClient({
      getTicket: returns(detail()),
      updateTicket: rejectWith(403, 'forbidden', 'Agents cannot change this project.'),
    });
    expect(await callTool(moveTicket, client, { ticket: 'MOB-3', status: 'Reviewed' })).toEqual(
      errorResult('Agents cannot change this project.'),
    );
  });

  it('explains 401 errors in terms of API tokens', async () => {
    const client = fakeClient({
      listProjects: rejectWith(401, 'unauthorized', 'Sign in to use this tracker.'),
      trackerUrl: 'https://t.example',
    });
    expect(await callTool(listProjects, client, {})).toEqual(
      errorResult(
        'The tracker at https://t.example needs an API token. Create one in the app: Connect Claude Code → API tokens. ' +
          'Then run "tracker login --url https://t.example" and paste it, or set TRACKER_API_TOKEN.',
      ),
    );
  });

  it('turns tool errors into error results', async () => {
    const client = fakeClient({ getTicket: returns(detail()) });
    const result = await callTool(moveTicket, client, { ticket: 'MOB-3', status: 'Doing' });
    expect(result.isError).toBe(true);
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('Valid statuses:') });
  });

  it('explains when the tracker server cannot be reached', async () => {
    const failure = new TypeError('fetch failed', {
      cause: new Error('connect ECONNREFUSED 127.0.0.1:4100'),
    });
    const client = fakeClient({ listProjects: () => Promise.reject(failure) });
    expect(await callTool(listProjects, client, {})).toEqual(
      errorResult(
        'Could not reach the tracker (connect ECONNREFUSED 127.0.0.1:4100). Is it running? Check TRACKER_URL (or --url).',
      ),
    );
  });

  it('never throws, even for unexpected errors', async () => {
    const client = fakeClient({ listProjects: () => Promise.reject(new Error('boom')) });
    expect(await callTool(listProjects, client, {})).toEqual(errorResult('boom'));
  });
});
