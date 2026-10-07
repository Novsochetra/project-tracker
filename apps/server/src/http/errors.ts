import type { Context, ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError, ERROR_STATUS } from '../errors';

const errorJson = (c: Context, code: string, message: string, status: ContentfulStatusCode) =>
  c.json({ error: { code, message } }, status);

export const handleError: ErrorHandler = (error, c) => {
  if (error instanceof AppError) {
    return errorJson(c, error.code, error.message, ERROR_STATUS[error.code]);
  }
  if (error instanceof HTTPException && error.status < 500) {
    return errorJson(c, 'invalid_input', error.message || 'Invalid request.', 400);
  }
  console.error(error);
  return errorJson(c, 'internal', 'Something went wrong on the server.', 500);
};

export const handleNotFound: NotFoundHandler = (c) =>
  errorJson(c, 'not_found', 'Nothing was found at this address.', 404);
