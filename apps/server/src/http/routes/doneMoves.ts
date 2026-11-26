import { moveToDoneInput, undoMoveToDoneInput } from '@tracker/shared';
import { Hono } from 'hono';
import type { ServiceContext } from '../../services/context';
import { moveToDone, undoMoveToDone } from '../../services/doneMoves';
import type { AppEnv } from '../env';
import { personMovesToDone, personUndoesDone } from '../personOnly';
import { userContext } from '../userContext';
import { jsonBody } from '../validation';

export const doneMoveRoutes = (ctx: ServiceContext) =>
  new Hono<AppEnv>()
    .post('/tickets/done', personMovesToDone, jsonBody(moveToDoneInput), async (context) =>
      context.json(
        await moveToDone(
          userContext(ctx, context),
          context.get('actor'),
          context.req.valid('json').keys,
        ),
      ),
    )
    .post('/tickets/done/undo', personUndoesDone, jsonBody(undoMoveToDoneInput), async (context) =>
      context.json(
        await undoMoveToDone(
          userContext(ctx, context),
          context.get('actor'),
          context.req.valid('json').tickets,
        ),
      ),
    );
