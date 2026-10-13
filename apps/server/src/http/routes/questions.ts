import { answerQuestionInput, askQuestionInput } from '@tracker/shared';
import { Hono } from 'hono';
import { answerQuestion, cancelQuestion } from '../../services/questionAnswers';
import { askQuestion, listQuestions } from '../../services/questions';
import { waitForQuestion } from '../../services/questionWait';
import type { ServiceContext } from '../../services/context';
import type { AppEnv } from '../env';
import { personAnswers } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

// Claude asks and waits with its API token; only the person answers, so an agent can't answer
// its own question.
export const questionRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/tickets/:key/questions', jsonBody(askQuestionInput), async (c) =>
      c.json(
        await askQuestion(
          userContext(ctx, c),
          c.get('actor'),
          c.req.param('key'),
          c.req.valid('json'),
        ),
        201,
      ),
    )
    .get('/tickets/:key/questions', async (c) =>
      c.json(await listQuestions(userContext(ctx, c), c.req.param('key'))),
    )
    .get('/questions/:id/wait', async (c) =>
      c.json(await waitForQuestion(userContext(ctx, c), c.req.param('id'), c.req.raw.signal)),
    )
    .post('/questions/:id/answer', personAnswers, jsonBody(answerQuestionInput), async (c) =>
      c.json(
        await answerQuestion(
          userContext(ctx, c),
          c.get('actor'),
          c.req.param('id'),
          c.req.valid('json'),
        ),
      ),
    )
    .post('/questions/:id/cancel', async (c) =>
      c.json(await cancelQuestion(userContext(ctx, c), c.req.param('id'))),
    );
