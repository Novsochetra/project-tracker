import { createCommentInput, updateTicketInput } from '@tracker/shared';

// The API's limits, so an overlong paste is cut short in the field instead of failing to save.
export const TITLE_MAX_LENGTH = updateTicketInput.shape.title.unwrap().maxLength ?? undefined;
export const DESCRIPTION_MAX_LENGTH =
  updateTicketInput.shape.description.unwrap().maxLength ?? undefined;
export const COMMENT_MAX_LENGTH = createCommentInput.shape.text.unwrap().maxLength ?? undefined;
