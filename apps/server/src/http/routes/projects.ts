import { createProjectInput, updateProjectInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import {
  createProject,
  deleteProject,
  getProjectDetail,
  listProjectSummaries,
  updateProject,
} from '../../services/projects';
import { projectPrompt } from '../../services/prompts';
import { getBoard } from '../../services/ticketQueries';
import type { AppEnv } from '../env';
import { jsonBody } from '../validation';

export const projectRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects', async (c) => c.json(await listProjectSummaries(ctx)))
    .post('/projects', jsonBody(createProjectInput), async (c) =>
      c.json(await createProject(ctx, c.req.valid('json')), 201),
    )
    .get('/projects/:key', async (c) => c.json(await getProjectDetail(ctx, c.req.param('key'))))
    .patch('/projects/:key', jsonBody(updateProjectInput), async (c) =>
      c.json(await updateProject(ctx, c.req.param('key'), c.req.valid('json'))),
    )
    .delete('/projects/:key', async (c) => {
      await deleteProject(ctx, c.req.param('key'));
      return c.body(null, 204);
    })
    .get('/projects/:key/board', async (c) => c.json(await getBoard(ctx, c.req.param('key'))))
    .get('/projects/:key/prompt', async (c) =>
      c.json(await projectPrompt(ctx, c.req.param('key'))),
    );
