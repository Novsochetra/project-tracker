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
    .post('/tickets/:key/questions', jsonBody(askQuestionInput), async (context) =>
      context.json(
        await askQuestion(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('key'),
          context.req.valid('json'),
        ),
        201,
      ),
    )
    .get('/tickets/:key/questions', async (context) =>
      context.json(await listQuestions(userContext(ctx, context), context.req.param('key'))),
    )
    .get('/questions/:id/wait', async (context) =>
      context.json(
        await waitForQuestion(
          userContext(ctx, context),
          context.req.param('id'),
          context.req.raw.signal,
        ),
      ),
    )
    .post('/questions/:id/answer', personAnswers, jsonBody(answerQuestionInput), async (context) =>
      context.json(
        await answerQuestion(
          userContext(ctx, context),
          context.get('actor'),
          context.req.param('id'),
          context.req.valid('json'),
        ),
      ),
    )
    .post('/questions/:id/cancel', async (context) =>
      context.json(await cancelQuestion(userContext(ctx, context), context.req.param('id'))),
    );
