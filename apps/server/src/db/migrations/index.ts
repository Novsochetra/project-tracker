import type { Migration } from 'kysely/migration';
import * as initial from './0001_initial';
import * as ticketClientId from './0002_ticket_client_id';
import * as attachmentPosition from './0003_attachment_position';
import * as ownerAuth from './0004_owner_auth';
import * as runs from './0005_runs';
import * as chats from './0006_chats';
import * as askOptions from './0007_ask_options';

// Keyed by file name; they run in name order, so the four-digit number decides. The bundled server
// can't list a folder, so a new file is added here too (test/unit/migrationFiles checks it is).
export const MIGRATIONS: Record<string, Migration> = {
  '0001_initial': initial,
  '0002_ticket_client_id': ticketClientId,
  '0003_attachment_position': attachmentPosition,
  '0004_owner_auth': ownerAuth,
  '0005_runs': runs,
  '0006_chats': chats,
  '0007_ask_options': askOptions,
};
