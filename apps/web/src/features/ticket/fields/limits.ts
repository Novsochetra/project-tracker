import {
  COMMENT_TEXT_MAX,
  TICKET_ASSIGNEE_MAX,
  TICKET_DESCRIPTION_MAX,
  TICKET_TITLE_MAX,
} from '@tracker/shared';

// The API's limits, so an overlong paste is cut short in the field instead of failing to save.
export const TITLE_MAX_LENGTH = TICKET_TITLE_MAX;
export const DESCRIPTION_MAX_LENGTH = TICKET_DESCRIPTION_MAX;
export const ASSIGNEE_MAX_LENGTH = TICKET_ASSIGNEE_MAX;
export const COMMENT_MAX_LENGTH = COMMENT_TEXT_MAX;
