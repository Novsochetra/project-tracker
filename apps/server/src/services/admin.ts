import { allStorageKeys } from '../repositories/attachments';
import { deleteAllRows } from '../repositories/reset';
import { listAssignees } from '../repositories/tickets';
import { removeFiles } from '../storage/fileStorage';
import { inTransaction, notify, type ServiceContext } from './context';

export async function listPeople(ctx: ServiceContext): Promise<string[]> {
  return (await listAssignees(ctx.db)).sort((a, b) => a.localeCompare(b));
}

export async function resetAllData(ctx: ServiceContext): Promise<void> {
  const files = await inTransaction(ctx, async (trx) => {
    const keys = await allStorageKeys(trx);
    await deleteAllRows(trx);
    return keys;
  });
  await removeFiles(ctx.storage, files);
  notify(ctx, null);
}
