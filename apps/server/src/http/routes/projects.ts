import { createProjectInput, reorderProjectsInput, updateProjectInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import {
  createProject,
  deleteProject,
  getProjectDetail,
  listProjectSummaries,
  updateProject,
} from '../../services/projects';
import { reorderProjects } from '../../services/projectOrder';
import { projectPrompt } from '../../services/prompts';
import { getBoard } from '../../services/ticketQueries';
import type { AppEnv } from '../env';
import { personCreatesProjects, personEditsProjects, personOrdersProjects } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const projectRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/projects', async (context) =>
      context.json(await listProjectSummaries(userContext(ctx, context))),
    )
    .post('/projects', personCreatesProjects, jsonBody(createProjectInput), async (context) =>
      context.json(await createProject(userContext(ctx, context), context.req.valid('json')), 201),
    )
    .put('/projects/order', personOrdersProjects, jsonBody(reorderProjectsInput), async (context) =>
      context.json(await reorderProjects(userContext(ctx, context), context.req.valid('json').ids)),
    )
    .get('/projects/:key', async (context) =>
      context.json(await getProjectDetail(userContext(ctx, context), context.req.param('key'))),
    )
    .patch('/projects/:key', personEditsProjects, jsonBody(updateProjectInput), async (context) =>
      context.json(
        await updateProject(
          userContext(ctx, context),
          context.req.param('key'),
          context.req.valid('json'),
        ),
      ),
    )
    .delete('/projects/:key', personEditsProjects, async (context) => {
      await deleteProject(userContext(ctx, context), context.req.param('key'));

      return context.body(null, 204);
    })
    .get('/projects/:key/board', async (context) =>
      context.json(await getBoard(userContext(ctx, context), context.req.param('key'))),
    )
    .get('/projects/:key/prompt', async (context) =>
      context.json(await projectPrompt(userContext(ctx, context), context.req.param('key'))),
    );
