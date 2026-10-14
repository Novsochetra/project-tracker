import {
  addChatChangesInput,
  chatCommitInput,
  chatPullRequestInput,
  finishGitActionInput,
} from '@tracker/shared';
import { Hono, type Context } from 'hono';
import { requireScope } from '../../auth/scope';
import { addChatChanges } from '../../services/chatChanges/addChatChanges';
import { finishGitAction } from '../../services/chatChanges/finishGitAction';
import { queueCommit, queuePullRequest } from '../../services/chatChanges/queueGitAction';
import { readChatChanges } from '../../services/chatChanges/readChatChanges';
import { takeGitAction } from '../../services/chatChanges/takeGitAction';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { helperOnly } from '../helperOnly';
import { personCommits } from '../personOnly';
import { jsonBody } from '../validation';

const scope = (c: Context<AppEnv>) => requireScope(c.get('access'));

const helperRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/runs/:id/chat-changes', helperOnly, jsonBody(addChatChangesInput), async (c) => {
      await addChatChanges(ctx, scope(c), c.req.param('id'), c.req.valid('json'));
      return c.body(null, 204);
    })
    .post('/runners/:id/git-actions/next', helperOnly, async (c) => {
      const job = await takeGitAction(ctx, scope(c), c.req.param('id'));
      return job ? c.json(job) : c.body(null, 204);
    })
    .post('/git-actions/:id/finish', helperOnly, jsonBody(finishGitActionInput), async (c) => {
      await finishGitAction(ctx, scope(c), c.req.param('id'), c.req.valid('json'));
      return c.body(null, 204);
    });

// Commit and Open PR are the person's; the helper runs only what the tracker hands it.
const personRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .get('/chats/:id/changes', async (c) =>
      c.json(await readChatChanges(ctx, scope(c), c.req.param('id'))),
    )
    .post('/chats/:id/changes/commit', personCommits, jsonBody(chatCommitInput), async (c) =>
      c.json(await queueCommit(ctx, scope(c), c.req.param('id'), c.req.valid('json'))),
    )
    .post(
      '/chats/:id/changes/pull-request',
      personCommits,
      jsonBody(chatPullRequestInput),
      async (c) =>
        c.json(await queuePullRequest(ctx, scope(c), c.req.param('id'), c.req.valid('json'))),
    );

export const chatChangesRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>().route('/', helperRoutes(ctx)).route('/', personRoutes(ctx));
