import type { ProjectDetail, ReportPreview, TicketDetail } from '@tracker/shared';
import { describe, expect, it } from 'vitest';
import { DIALECTS, useTestServer } from '../helpers/server';

// resolveStatus('reviewed') used to fall back to a Done status when a project had no Reviewed
// or Need review status, so an "approved" report could move a ticket to Done.
describe.each(DIALECTS)('reports never set Done (%s)', (dialect) => {
  const api = useTestServer(dialect);

  it('picks a status that is not Done when Reviewed and Need review are missing', async () => {
    const project = (await api.post<ProjectDetail>('/api/projects', { name: 'Mobile app' })).body;
    for (const status of project.statuses) {
      if (status.category === 'in_review' || status.category === 'reviewed') {
        await api.delete(`/api/statuses/${status.id}`);
      }
    }
    await api.post('/api/projects/MA/tickets', { title: 'Crash' });
    const text = 'TICKET: MA-1\nSTATUS: approved';

    const preview = await api.post<ReportPreview>('/api/reports/preview', { text });
    expect(preview.body.items[0]?.toStatusName).toBe('In progress');
    expect((await api.post('/api/reports/apply', { text })).status).toBe(200);
    const detail = (await api.get<TicketDetail>('/api/tickets/MA-1')).body;
    expect(detail.status.category).toBe('in_progress');
  });
});
