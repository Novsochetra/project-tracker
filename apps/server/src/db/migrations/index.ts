import type { Migration } from 'kysely/migration';
import * as initial from './0001_initial';
import * as ticketClientId from './0002_ticket_client_id';
import * as attachmentPosition from './0003_attachment_position';
import * as ownerAuth from './0004_owner_auth';
import * as runs from './0005_runs';
import * as chats from './0006_chats';
import * as askOptions from './0007_ask_options';
import * as runSteps from './0008_run_steps';
import * as runRequests from './0009_run_requests';
import * as askEffort from './0010_ask_effort';
import * as userProjects from './0011_user_projects';
import * as passwordResets from './0012_password_resets';
import * as runRole from './0013_run_role';
import * as chatTicket from './0014_chat_ticket';
import * as questions from './0015_questions';
import * as pushSubscriptions from './0016_push_subscriptions';
import * as projectInstructions from './0017_project_instructions';
import * as runUsage from './0018_run_usage';
import * as autoReview from './0019_auto_review';
import * as runnerTools from './0020_runner_tools';
import * as cardTickets from './0021_card_tickets';
import * as chatAttachments from './0022_chat_attachments';
import * as labels from './0023_labels';
import * as runAll from './0024_run_all';
import * as batchRuns from './0025_batch_runs';
import * as subAgents from './0026_sub_agents';
import * as runChanges from './0027_run_changes';
import * as hideName from './0028_hide_name';
import * as runStepTodos from './0029_run_step_todos';
import * as chatQueue from './0030_chat_queue';

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
  '0008_run_steps': runSteps,
  '0009_run_requests': runRequests,
  '0010_ask_effort': askEffort,
  '0011_user_projects': userProjects,
  '0012_password_resets': passwordResets,
  '0013_run_role': runRole,
  '0014_chat_ticket': chatTicket,
  '0015_questions': questions,
  '0016_push_subscriptions': pushSubscriptions,
  '0017_project_instructions': projectInstructions,
  '0018_run_usage': runUsage,
  '0019_auto_review': autoReview,
  '0020_runner_tools': runnerTools,
  '0021_card_tickets': cardTickets,
  '0022_chat_attachments': chatAttachments,
  '0023_labels': labels,
  '0024_run_all': runAll,
  '0025_batch_runs': batchRuns,
  '0026_sub_agents': subAgents,
  '0027_run_changes': runChanges,
  '0028_hide_name': hideName,
  '0029_run_step_todos': runStepTodos,
  '0030_chat_queue': chatQueue,
};
