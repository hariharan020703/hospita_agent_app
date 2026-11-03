// Errors every service implementation (mock or API) throws. `code` maps to i18n key `common:errors.<code>`.

export const SERVICE_ERROR_CODES = [
  'NETWORK',
  'NOT_FOUND',
  'SLOT_TAKEN',
  'NO_SLOTS',
  'PATIENT_BUSY',
  'TOO_LATE',
  'INVALID_STATE',
  'INVALID_OTP',
  'VALIDATION',
  'CONFLICT',
  'FORBIDDEN',
  'UNKNOWN',
] as const;
export type ServiceErrorCode = (typeof SERVICE_ERROR_CODES)[number];

export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  readonly status: number | undefined;

  constructor(code: ServiceErrorCode, message?: string, status?: number) {
    super(message ?? code);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
  }
}

export const isServiceError = (error: unknown): error is ServiceError => error instanceof ServiceError;

export const errorCodeOf = (error: unknown): ServiceErrorCode => (isServiceError(error) ? error.code : 'UNKNOWN');
