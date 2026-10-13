import type { UserScope } from '../auth/scope';
import type { Db } from '../db/schema';
import { ownedBy } from './runs';

// sum() is null when no run has the figure, so the app leaves out what nobody sent.
export const projectUsageSince = (db: Db, userId: UserScope, projectId: string, since: number) =>
  db
    .selectFrom('runs')
    .select((eb) => [
      eb.fn.countAll().as('runs'),
      eb.fn.sum('runs.costMicros').as('costMicros'),
      eb.fn.sum('runs.turns').as('turns'),
      eb.fn.sum('runs.durationMs').as('durationMs'),
    ])
    .where(ownedBy(userId))
    .where('runs.projectId', '=', projectId)
    .where('runs.endedAt', '>=', since)
    .where((eb) =>
      eb.or([
        eb('runs.costMicros', 'is not', null),
        eb('runs.turns', 'is not', null),
        eb('runs.durationMs', 'is not', null),
      ]),
    )
    .executeTakeFirstOrThrow();
