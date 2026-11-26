import { UNKNOWN_ROUTE_MESSAGE } from '@tracker/shared';
import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError, ERROR_STATUS } from '../errors';

const errorJson = (context: Context, code: string, message: string, status: ContentfulStatusCode) =>
  context.json({ error: { code, message } }, status);

export const handleError: ErrorHandler = (error, context) => {
  if (error instanceof AppError) {
    return errorJson(context, error.code, error.message, ERROR_STATUS[error.code]);
  }

  if (error instanceof HTTPException && error.status < 500) {
    return errorJson(context, 'invalid_input', error.message || 'Invalid request.', 400);
  }

  console.error(error);

  return errorJson(context, 'internal', 'Something went wrong on the server.', 500);
};

export const handleNotFound: NotFoundHandler = (context) =>
  errorJson(context, 'not_found', UNKNOWN_ROUTE_MESSAGE, 404);
