export const ERROR_STATUS = {
  invalid_input: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  stale: 409,
  no_match: 422,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const invalidInput = (message: string) => new AppError('invalid_input', message);

export const notFound = (message: string) => new AppError('not_found', message);

export const conflict = (message: string) => new AppError('conflict', message);

export const staleEdit = () =>
  new AppError('stale', 'The ticket changed since this edit was typed. Read it again first.');

export const forbidden = (message: string) => new AppError('forbidden', message);
