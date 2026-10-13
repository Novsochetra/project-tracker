import { RUN_PROMPT_MAX } from '@tracker/shared';

const count = new Intl.NumberFormat('en-US');

// A chat card has no prompt box to shorten, so it says where to go instead.
export class PromptTooLongError extends Error {
  constructor(length: number) {
    super(
      `A run takes a prompt of up to ${count.format(RUN_PROMPT_MAX)} characters. ` +
        `This ticket’s has ${count.format(length)}: open the ticket to shorten it and run it from there.`,
    );
  }
}
