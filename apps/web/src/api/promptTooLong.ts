import { RUN_PROMPT_MAX } from '@tracker/shared';
import { errorMessage } from './errors';

const count = new Intl.NumberFormat('en-US');

// A chat card has no prompt box to shorten, so it says where to go instead.
export class PromptTooLongError extends Error {
  constructor(length: number) {
    super(
      `A run takes a prompt of up to ${count.format(RUN_PROMPT_MAX)} characters. ` +
        `This ticket’s prompt has ${count.format(length)}: open the ticket to shorten it and run it from there.`,
    );
  }
}

// errorMessage shows the tracker's own words; this one the app says itself.
export const runErrorMessage = (error: unknown): string =>
  error instanceof PromptTooLongError ? error.message : errorMessage(error);
