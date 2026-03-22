export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string | number) {
    super('NOT_FOUND', `${resource} not found`, 404, { resource, id });
  }
}

export class UnauthorizedError extends AppError {
  constructor(reason: string) {
    super('UNAUTHORIZED', reason, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(action: string, role: string) {
    super('FORBIDDEN', `Role '${role}' cannot perform '${action}'`, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('RATE_LIMITED', 'Too many attempts, try again later', 429);
  }
}
