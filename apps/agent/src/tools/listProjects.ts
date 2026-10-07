import { z } from 'zod';
import { formatProjects } from '../format/projects';
import { defineTool } from './tool';

export const listProjects = defineTool({
  name: 'list_projects',
  description:
    'List every project in the tracker, one line each: key · name · open and total ticket counts · repository. ' +
    'Call this first when you do not know the project key (the ticket prefix, e.g. MOB) that the other tools need. ' +
    'The repository tells you which folder or repo a project belongs to.',
  input: z.object({}),
  readOnly: true,
  async handler(client) {
    const projects = await client.listProjects();
    return { text: formatProjects(projects), data: projects };
  },
});
