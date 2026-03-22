import { AppError } from '../lib/errors';

export type Result<T, E = AppError> =
  | { ok: true; data: T }
  | { ok: false; error: E };
