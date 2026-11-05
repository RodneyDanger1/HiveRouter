import type { RefusalCode } from '../../shared/refusals.js';
import { REFUSALS } from '../../shared/refusals.js';

export class LearningError extends Error {
  readonly code: RefusalCode;
  readonly details: Record<string, unknown>;

  constructor(code: RefusalCode, message?: string, details: Record<string, unknown> = {}) {
    super(message ?? REFUSALS[code].message);
    this.name = 'LearningError';
    this.code = code;
    this.details = details;
  }
}

export function isLearningError(error: unknown): error is LearningError {
  return error instanceof LearningError;
}

export function refuse(
  code: RefusalCode,
  message?: string,
  details: Record<string, unknown> = {},
): never {
  throw new LearningError(code, message, details);
}
