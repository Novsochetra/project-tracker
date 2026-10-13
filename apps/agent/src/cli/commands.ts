import { addComment } from '../tools/addComment';
import { attachFile } from '../tools/attachFile';
import { claimNextTicket } from '../tools/claimNextTicket';
import { claimTicket } from '../tools/claimTicket';
import { createTicket } from '../tools/createTicket';
import { TICKET_KEY } from '../tools/fields';
import { getTicket } from '../tools/getTicket';
import { listProjects } from '../tools/listProjects';
import { listStatuses } from '../tools/listStatuses';
import { listTickets } from '../tools/listTickets';
import { moveTicket } from '../tools/moveTicket';
import { reviewTicket } from '../tools/reviewTicket';
import { submitForReview } from '../tools/submitForReview';
import type { Tool } from '../tools/tool';
import { updateTicket } from '../tools/updateTicket';
import type { CommandOption, CommandValues } from './options';

export interface Plan {
  tool: Tool;
  input: Record<string, unknown>;
}

export interface Command {
  name: string;
  usage: string;
  summary: string;
  args: readonly string[];
  // The last argument takes every remaining word, so multi-word names need no quotes.
  rest?: boolean;
  options: readonly CommandOption[];
  required?: readonly CommandOption[];
  plan(args: readonly string[], options: CommandValues): Plan;
}

const toNumber = (value: string | undefined): number | undefined =>
  value === undefined ? undefined : Number(value);

function withLabels({ label, ...options }: CommandValues): Record<string, unknown> {
  if (label === undefined) return options;
  const labels = label.split(',').map((name) => name.trim());
  return { ...options, labels: labels.filter((name) => name !== '') };
}

export const COMMANDS: readonly Command[] = [
  {
    name: 'projects',
    usage: 'projects',
    summary: 'List projects with their keys and ticket counts.',
    args: [],
    options: [],
    plan: () => ({ tool: listProjects, input: {} }),
  },
  {
    name: 'statuses',
    usage: 'statuses <PROJECT>',
    summary: "List a project's statuses and their categories.",
    args: ['PROJECT'],
    options: [],
    plan: ([project]) => ({ tool: listStatuses, input: { project } }),
  },
  {
    name: 'tickets',
    usage: 'tickets <PROJECT> [--status NAME] [--category CAT] [--label NAME] [--query Q]',
    summary: "List a project's tickets, optionally filtered.",
    args: ['PROJECT'],
    options: ['status', 'category', 'label', 'query'],
    plan: ([project], options) => ({ tool: listTickets, input: { project, ...options } }),
  },
  {
    name: 'show',
    usage: 'show <KEY>',
    summary: 'Show a ticket in full: activity, text files inline, links to videos and PDFs.',
    args: ['KEY'],
    options: [],
    plan: ([ticket]) => ({ tool: getTicket, input: { ticket } }),
  },
  {
    name: 'create',
    usage:
      'create <PROJECT> --title T [--description D] [--priority high|medium|low] [--status NAME] [--label "A, B"]',
    summary: 'Create a ticket.',
    args: ['PROJECT'],
    options: ['title', 'description', 'priority', 'status', 'label'],
    required: ['title'],
    plan: ([project], options) => ({
      tool: createTicket,
      input: { project, ...withLabels(options) },
    }),
  },
  {
    name: 'update',
    usage:
      'update <KEY> [--title T] [--description D] [--priority P] [--assignee NAME] [--due YYYY-MM-DD] [--label "A, B"]',
    summary: 'Edit ticket fields. An empty --assignee, --due or --label clears it.',
    args: ['KEY'],
    options: ['title', 'description', 'priority', 'assignee', 'due', 'label'],
    plan: ([ticket], options) => ({
      tool: updateTicket,
      input: { ticket, ...withLabels(options) },
    }),
  },
  {
    name: 'move',
    usage: 'move <KEY> <STATUS NAME…>',
    summary: 'Move a ticket to a status (not Done: only a person does that).',
    args: ['KEY', 'STATUS NAME'],
    rest: true,
    options: [],
    plan: ([ticket, ...status]) => ({
      tool: moveTicket,
      input: { ticket, status: status.join(' ') },
    }),
  },
  {
    name: 'comment',
    usage: 'comment <KEY> <TEXT…>',
    summary: 'Add a comment to a ticket.',
    args: ['KEY', 'TEXT'],
    rest: true,
    options: [],
    plan: ([ticket, ...text]) => ({ tool: addComment, input: { ticket, text: text.join(' ') } }),
  },
  {
    name: 'attach',
    usage: 'attach <KEY> <FILE…> [--comment TEXT]',
    summary:
      'Attach files from this folder or a temp folder to a ticket, or to a new comment with --comment.',
    args: ['KEY', 'FILE'],
    rest: true,
    options: ['comment'],
    plan: ([ticket, ...paths], options) => ({
      tool: attachFile,
      input: { ticket, paths, ...options },
    }),
  },
  {
    name: 'claim',
    usage: 'claim <PROJECT|KEY>',
    summary: 'Claim the next To do ticket in a project, or one ticket, and move it to In progress.',
    args: ['PROJECT|KEY'],
    options: [],
    plan: ([target = '']) =>
      TICKET_KEY.test(target.trim())
        ? { tool: claimTicket, input: { ticket: target } }
        : { tool: claimNextTicket, input: { project: target } },
  },
  {
    name: 'submit',
    usage: 'submit <KEY> --summary S [--files F] [--output O] [--next N]',
    summary: 'Submit finished work for review.',
    args: ['KEY'],
    options: ['summary', 'files', 'output', 'next'],
    required: ['summary'],
    plan: ([ticket], options) => ({ tool: submitForReview, input: { ticket, ...options } }),
  },
  {
    name: 'review',
    usage: 'review <KEY> --verdict approved|changes_requested --rating 1-5 --summary S',
    summary: 'Review a ticket in Need review.',
    args: ['KEY'],
    options: ['verdict', 'rating', 'summary'],
    required: ['verdict', 'rating', 'summary'],
    plan: ([ticket], options) => ({
      tool: reviewTicket,
      input: { ticket, ...options, rating: toNumber(options.rating) },
    }),
  },
];

export const findCommand = (name: string): Command | undefined =>
  COMMANDS.find((command) => command.name === name);
