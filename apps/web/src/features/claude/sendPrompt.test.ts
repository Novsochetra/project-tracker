import type { Status, TicketDetail } from '@tracker/shared';
import { describe, expect, it, vi } from 'vitest';
import { listItem, makeTicketDetail, STATUS, statuses } from '../../api/test/fixtures';
import {
  copyPromptFlow,
  joinSubtitle,
  movesOnSend,
  NO_OPEN_TICKETS,
  openTicketsLabel,
  PROMPT_HELP,
  promptHelp,
  promptRole,
  REVIEW_PROMPT_HELP,
  RUN_PROMPT_HELP,
  RUN_REVIEW_HELP,
  sendTarget,
  sheetTitle,
  sharePromptFlow,
  showsSwitch,
  switchLabel,
} from './sendPrompt';

const inStatus = (statusId: string, list: Status[] = statuses): TicketDetail =>
  makeTicketDetail(listItem(1, statusId, 0), {
    statuses: list,
    status: list.find((status) => status.id === statusId)!,
  });

const inProgress = statuses.find((status) => status.id === STATUS.progress)!;

describe('promptHelp', () => {
  it('speaks of both buttons only when Run is offered', () => {
    expect(promptHelp(true, false, 'work')).toBe(PROMPT_HELP);
    expect(promptHelp(true, true, 'work')).toBe(RUN_PROMPT_HELP);
    expect(promptHelp(false, false, 'work')).toBe(NO_OPEN_TICKETS);
  });

  it('speaks of a review for a review prompt', () => {
    expect(promptHelp(true, false, 'review')).toBe(REVIEW_PROMPT_HELP);
    expect(promptHelp(true, true, 'review')).toBe(RUN_REVIEW_HELP);
  });
});

describe('a review prompt', () => {
  it('titles the sheet Review with Claude', () => {
    expect(sheetTitle('review')).toBe('Review with Claude');
    expect(sheetTitle('work')).toBe('Send to Claude Code');
  });

  it('takes the role from the prompt, and from the ticket’s status until it loads', () => {
    const review = inStatus(STATUS.review);
    expect(promptRole(null, review)).toBe('review');
    expect(promptRole(null, inStatus(STATUS.todo))).toBe('work');
    expect(promptRole(null, undefined)).toBe('work');
    expect(promptRole({ text: 'Go', ticketCount: 1, role: 'work' }, review)).toBe('work');
  });
});

describe('subtitles', () => {
  it('counts open tickets in words', () => {
    expect(openTicketsLabel(0)).toBe('0 open tickets');
    expect(openTicketsLabel(1)).toBe('1 open ticket');
    expect(openTicketsLabel(4)).toBe('4 open tickets');
  });

  it('joins the parts that are known with a middle dot', () => {
    expect(joinSubtitle('MOB-3', 'Mobile app')).toBe('MOB-3 · Mobile app');
    expect(joinSubtitle('MOB-3', undefined)).toBe('MOB-3');
    expect(joinSubtitle(undefined, 'Mobile app')).toBe('Mobile app');
  });
});

describe('sendTarget', () => {
  it('is the In progress status for a ticket in To do', () => {
    expect(sendTarget(inStatus(STATUS.todo))).toEqual(inProgress);
  });

  it('uses the project’s own name for In progress', () => {
    const renamed = statuses.map((status) =>
      status.id === STATUS.progress ? { ...status, name: 'Doing' } : status,
    );
    expect(sendTarget(inStatus(STATUS.todo, renamed))?.name).toBe('Doing');
  });

  it('is null outside To do, before the ticket loads, and without an In progress status', () => {
    expect(sendTarget(inStatus(STATUS.progress))).toBeNull();
    expect(sendTarget(inStatus(STATUS.done))).toBeNull();
    expect(sendTarget(undefined)).toBeNull();
    const noProgress = statuses.filter((status) => status.category !== 'in_progress');
    expect(sendTarget(inStatus(STATUS.todo, noProgress))).toBeNull();
  });
});

describe('the switch', () => {
  it('reads “Move KEY to” the target status', () => {
    expect(switchLabel('MOB-3', inProgress)).toBe('Move MOB-3 to In progress');
  });

  it('shows until the ticket is sent, and only with a target', () => {
    expect(showsSwitch(inProgress, false)).toBe(true);
    expect(showsSwitch(inProgress, true)).toBe(false);
    expect(showsSwitch(null, false)).toBe(false);
  });

  it('moves the ticket only when it is on and there is a target', () => {
    expect(movesOnSend(inProgress, true)).toBe(true);
    expect(movesOnSend(inProgress, false)).toBe(false);
    expect(movesOnSend(null, true)).toBe(false);
  });
});

describe('copyPromptFlow', () => {
  it('toasts and marks the ticket as sent when copying works', async () => {
    const notify = vi.fn();
    const markSent = vi.fn();
    const outcome = await copyPromptFlow({ copy: () => Promise.resolve(true), notify, markSent });
    expect(outcome).toBe('copied');
    expect(notify).toHaveBeenCalledWith('Prompt copied');
    expect(markSent).toHaveBeenCalledTimes(1);
  });

  it('does neither when copying is blocked', async () => {
    const notify = vi.fn();
    const markSent = vi.fn();
    const outcome = await copyPromptFlow({ copy: () => Promise.resolve(false), notify, markSent });
    expect(outcome).toBe('failed');
    expect(notify).not.toHaveBeenCalled();
    expect(markSent).not.toHaveBeenCalled();
  });
});

describe('sharePromptFlow', () => {
  it('marks the ticket as sent only when sharing went through', async () => {
    const markSent = vi.fn();
    await expect(sharePromptFlow({ share: () => Promise.resolve(false), markSent })).resolves.toBe(
      false,
    );
    expect(markSent).not.toHaveBeenCalled();
    await expect(sharePromptFlow({ share: () => Promise.resolve(true), markSent })).resolves.toBe(
      true,
    );
    expect(markSent).toHaveBeenCalledTimes(1);
  });
});
