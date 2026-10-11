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
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const projectRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects', async (c) => c.json(await listProjectSummaries(userContext(ctx, c))))
    .post('/projects', jsonBody(createProjectInput), async (c) =>
      c.json(await createProject(userContext(ctx, c), c.req.valid('json')), 201),
    )
    .get('/projects/:key', async (c) =>
      c.json(await getProjectDetail(userContext(ctx, c), c.req.param('key'))),
    )
    .patch('/projects/:key', jsonBody(updateProjectInput), async (c) =>
      c.json(await updateProject(userContext(ctx, c), c.req.param('key'), c.req.valid('json'))),
    )
    .delete('/projects/:key', async (c) => {
      await deleteProject(userContext(ctx, c), c.req.param('key'));
      return c.body(null, 204);
    })
    .get('/projects/:key/board', async (c) =>
      c.json(await getBoard(userContext(ctx, c), c.req.param('key'))),
    )
    .get('/projects/:key/prompt', async (c) =>
      c.json(await projectPrompt(userContext(ctx, c), c.req.param('key'))),
    );
