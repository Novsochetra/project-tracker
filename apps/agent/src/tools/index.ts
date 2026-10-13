import { addComment } from './addComment';
import { attachFile } from './attachFile';
import { claimNextTicket } from './claimNextTicket';
import { claimTicket } from './claimTicket';
import { createTicket } from './createTicket';
import { getTicket } from './getTicket';
import { listProjects } from './listProjects';
import { listStatuses } from './listStatuses';
import { listTickets } from './listTickets';
import { moveTicket } from './moveTicket';
import { reviewTicket } from './reviewTicket';
import { submitForReview } from './submitForReview';
import type { Tool } from './tool';
import { updateTicket } from './updateTicket';

export const TOOLS: readonly Tool[] = [
  listProjects,
  listStatuses,
  listTickets,
  getTicket,
  createTicket,
  updateTicket,
  moveTicket,
  addComment,
  attachFile,
  claimNextTicket,
  claimTicket,
  submitForReview,
  reviewTicket,
];
