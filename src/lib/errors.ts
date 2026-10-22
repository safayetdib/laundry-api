/**
 * Application error with an HTTP status, a stable machine-readable `code`
 * and optional structured `details`. Thrown by services/middleware and
 * translated to the error envelope by the central error handler.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request.', details: unknown = null) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request input.', details: unknown = null) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.', details: unknown = null) {
    super(401, 'UNAUTHENTICATED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Not authorized.', details: unknown = null) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.', details: unknown = null) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'State conflict.', details: unknown = null) {
    super(409, 'CONFLICT', message, details);
  }
}

export class UnprocessableError extends AppError {
  constructor(message = 'Request rejected by business rules.', details: unknown = null) {
    super(422, 'UNPROCESSABLE', message, details);
  }
}

/** Safely extracts a numeric HTTP status from an unknown thrown value. */
export function readErrorStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null) {
    const record = err as { status?: unknown; statusCode?: unknown };
    if (typeof record.statusCode === 'number') return record.statusCode;
    if (typeof record.status === 'number') return record.status;
  }
  return undefined;
}
