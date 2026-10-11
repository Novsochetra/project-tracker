import type { ProjectDetail, ReportPreview } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { eventTexts, statusOf } from '../helpers/fixtures';
import { DIALECTS, useTestServer } from '../helpers/server';

// A reviewer's own "STATUS: done" report, posted right after approving, moved the ticket from
// Reviewed back to Need review because any differing status a report named became the target.
describe.each(DIALECTS)(
  'reports never move a ticket back from Reviewed or Done (%s)',
  (dialect) => {
    const api = useTestServer(dialect);

    it.each(['reviewed', 'done'] as const)(
      'keeps a %s ticket where it is and still adds the report',
      async (category) => {
        const project = (await api.post<ProjectDetail>('/api/projects', { name: 'Mobile app' }))
          .body;
        await api.client().createTicket('MA', {
          title: 'Crash',
          statusId: statusOf(project, category).id,
        });
        const text = 'TICKET: MA-1\nSTATUS: done\nSUMMARY: Approved 5/5.';

        const preview = await api.post<ReportPreview>('/api/reports/preview', { text });
        expect(preview.body.items[0]?.toStatusName).toBeNull();
        expect((await api.post('/api/reports/apply', { text })).status).toBe(200);
        const detail = await api.client().getTicket('MA-1');
        expect(detail.status.category).toBe(category);
        expect(detail.activity.at(-1)).toMatchObject({ type: 'report', text });
        expect(eventTexts(detail).some((t) => t.includes('Claude Code report'))).toBe(false);
      },
    );

    it('keeps a custom reviewed status when a report says approved', async () => {
      await api.post<ProjectDetail>('/api/projects', { name: 'Mobile app' });
      const qa = await api.client().createStatus('MA', { name: 'QA passed', category: 'reviewed' });
      await api.client().createTicket('MA', { title: 'Crash', statusId: qa.id });
      const text = 'TICKET: MA-1\nSTATUS: approved';

      const preview = await api.post<ReportPreview>('/api/reports/preview', { text });
      expect(preview.body.items[0]?.toStatusName).toBeNull();
      expect((await api.post('/api/reports/apply', { text })).status).toBe(200);
      expect((await api.client().getTicket('MA-1')).status.name).toBe('QA passed');
    });
  },
);
