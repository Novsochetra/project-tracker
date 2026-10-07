import { z } from 'zod';
import { claimedReply } from './claimed';
import { projectKey } from './fields';
import { defineTool } from './tool';

export const claimNextTicket = defineTool({
  name: 'claim_next_ticket',
  description:
    'Claim the next ticket to work on in a project: the highest-priority ticket in a To do status (then manual ' +
    'order, then oldest). Claiming moves it to In progress and returns it in full like get_ticket, with images. ' +
    'If a reviewer sent the ticket back, its last review says what to fix. Returns a message when nothing is waiting.',
  input: z.object({ project: projectKey }),
  readOnly: false,
  async handler(client, { project }) {
    const detail = await client.claimNext(project);
    if (!detail) {
      return {
        text: `No tickets to claim in ${project}: nothing is waiting in a To do status.`,
        data: null,
      };
    }
    return claimedReply(detail);
  },
});
