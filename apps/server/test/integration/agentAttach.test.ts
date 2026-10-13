import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { attachFile } from '../../../agent/src/tools/attachFile';
import { agent, pngBytes } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

const work = realpathSync(mkdtempSync(join(tmpdir(), 'agent-attach-')));
writeFileSync(join(work, 'plan.md'), '# Launch plan\n');
writeFileSync(join(work, 'budget.csv'), 'month,amount\nNov,120\n');
writeFileSync(join(work, 'chart.png'), pngBytes(4, 3));
const paths = ['plan.md', 'budget.csv', 'chart.png'].map((name) => join(work, name));

afterAll(() => rmSync(work, { recursive: true, force: true }));

describe.each(DIALECTS)('attach_file through the typed client (%s)', (dialect) => {
  const api = useTestServer(dialect);
  const claude = () => api.client(agent('Claude'));

  beforeEach(async () => {
    await api.client().createProject({ name: 'Mobile app' });
    await api.client().createTicket('MA', { title: 'Plan the launch' });
  });

  const attach = (input: { paths: string[]; comment?: string }) =>
    attachFile.handler(claude(), attachFile.input.parse({ ticket: 'ma-1', ...input }));

  it('adds a Markdown file, a CSV and an image to the ticket, in order', async () => {
    const reply = await attach({ paths });
    expect(reply.text).toBe('Attached plan.md, budget.csv and chart.png to MA-1.');
    const { attachments } = await api.client().getTicket('MA-1');
    expect(attachments.map(({ fileName, mimeType }) => [fileName, mimeType])).toEqual([
      ['plan.md', 'text/markdown'],
      ['budget.csv', 'text/csv'],
      ['chart.png', 'image/png'],
    ]);
    expect(attachments[2]).toMatchObject({ width: 4, height: 3 });
    expect(await api.client().fetchAttachmentText(attachments[1]?.id ?? '')).toBe(
      'month,amount\nNov,120\n',
    );
  });

  it('adds them to a new comment by Claude when given one', async () => {
    await attach({ paths: paths.slice(0, 2), comment: 'The plan and its budget.' });
    const detail = await api.client().getTicket('MA-1');
    expect(detail.attachments).toEqual([]);
    const comment = detail.activity.at(-1);
    expect(comment).toMatchObject({
      type: 'comment',
      text: 'The plan and its budget.',
      actor: { kind: 'agent', name: 'Claude' },
    });
    expect(comment?.attachments.map((file) => file.fileName)).toEqual(['plan.md', 'budget.csv']);
  });

  it('refuses a file outside the allowed folders and sends nothing', async () => {
    await expect(attach({ paths: [paths[0] ?? '', '/etc/hosts'] })).rejects.toThrow(
      "Can't attach /etc/hosts: only files in this folder or a temp folder can be attached",
    );
    expect((await api.client().getTicket('MA-1')).attachments).toEqual([]);
  });
});
