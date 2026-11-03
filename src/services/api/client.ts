// Minimal REST client for the future backend: JSON in/out, bearer token, typed errors, optional zod validation.
import type { ZodType } from 'zod';
import { ServiceError, SERVICE_ERROR_CODES, type ServiceErrorCode } from '../errors';

type Query = Record<string, string | number | boolean | undefined | null | readonly string[]>;

export interface RequestOptions<T> {
  query?: Query;
  body?: unknown;
  /** Validates the response; recommended for every call so contract drift fails loudly. */
  schema?: ZodType<T>;
}

export class ApiClient {
  private token: string | null = null;

  constructor(private readonly baseUrl: string) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  get<T>(path: string, options: RequestOptions<T> = {}) {
    return this.request<T>('GET', path, options);
  }
  post<T>(path: string, options: RequestOptions<T> = {}) {
    return this.request<T>('POST', path, options);
  }
  put<T>(path: string, options: RequestOptions<T> = {}) {
    return this.request<T>('PUT', path, options);
  }
  patch<T>(path: string, options: RequestOptions<T> = {}) {
    return this.request<T>('PATCH', path, options);
  }
  delete<T>(path: string, options: RequestOptions<T> = {}) {
    return this.request<T>('DELETE', path, options);
  }

  private url(path: string, query?: Query): string {
    const url = new URL(`${this.baseUrl.replace(/\/$/, '')}${path}`, window.location.origin);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
      else url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private async request<T>(method: string, path: string, { query, body, schema }: RequestOptions<T>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(this.url(path, query), {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new ServiceError('NETWORK');
    }
    if (!response.ok) throw await toServiceError(response);
    if (response.status === 204) return undefined as T;
    const data: unknown = await response.json();
    if (!schema) return data as T;
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new ServiceError('UNKNOWN', `Unexpected response from ${path}`);
    return parsed.data;
  }
}

/** Backend errors are expected as `{ "code": "SLOT_TAKEN", "message": "..." }`; otherwise mapped from the status. */
async function toServiceError(response: Response): Promise<ServiceError> {
  let code: ServiceErrorCode =
    response.status === 404
      ? 'NOT_FOUND'
      : response.status === 403
        ? 'FORBIDDEN'
        : response.status === 409
          ? 'CONFLICT'
          : response.status === 422 || response.status === 400
            ? 'VALIDATION'
            : 'UNKNOWN';
  let message: string | undefined;
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    if (body.code && (SERVICE_ERROR_CODES as readonly string[]).includes(body.code))
      code = body.code as ServiceErrorCode;
    message = body.message;
  } catch {
    // Not JSON: keep the status-based code.
  }
  return new ServiceError(code, message, response.status);
}
