import type { ChainStop } from '@tracker/shared';
import type { Db } from '../db/schema';

export async function markChainStop(db: Db, id: string, chainStop: ChainStop): Promise<void> {
  await db.updateTable('runs').set({ chainStop }).where('id', '=', id).execute();
}
