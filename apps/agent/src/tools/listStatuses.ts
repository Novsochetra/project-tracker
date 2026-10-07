import { sortStatuses } from '@tracker/shared';
import { z } from 'zod';
import { formatStatuses } from '../format/statuses';
import { projectKey } from './fields';
import { defineTool } from './tool';

export const listStatuses = defineTool({
  name: 'list_statuses',
  description:
    "List a project's statuses in board order, one line each: name · category. " +
    'Categories give a status its meaning: todo, in_progress, in_review (needs review), reviewed and done. ' +
    'Use it to find the exact status names that move_ticket, create_ticket and list_tickets accept.',
  input: z.object({ project: projectKey }),
  readOnly: true,
  async handler(client, { project }) {
    const statuses = sortStatuses((await client.getProject(project)).statuses);
    return { text: formatStatuses(statuses), data: statuses };
  },
});
