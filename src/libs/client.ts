import { sleep } from 'k6';
import http, { RefinedResponse, ResponseType } from 'k6/http';
import { EnvConfig } from '../config/env.js';
import { AuthProvider, NoAuthProvider } from './auth.js';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.js';
import { recordApiMetrics } from './metrics.js';

export interface RequestOptions {
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  timeout?: string;
  responseType?: ResponseType;
  maxRetries?: number;
}

export interface ApiClientOptions {
  authProvider?: AuthProvider;
  enableCorrelationId?: boolean;
  logErrors?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
  sleepFn?: (seconds: number) => void;
  circuitBreaker?: CircuitBreaker;
}

export interface TypedResponse<T> {
  response: RefinedResponse<ResponseType>;
  data: T | null;
}

const DEFAULT_RETRY_STATUSES = [0, 429, 502, 503, 504];

const generateCorrelationId = (): string => {
  const rand = Math.random().toString(16).slice(2, 10);
  return `k6-${Date.now().toString(36)}-${rand}`;
};

export class ApiClient {
  private readonly config: EnvConfig;
  private readonly authProvider: AuthProvider;
  private readonly enableCorrelationId: boolean;
  private readonly logErrors: boolean;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly retryOnStatuses: Set<number>;
  private readonly sleepFn: (seconds: number) => void;
  private readonly circuitBreaker?: CircuitBreaker;

  constructor(config: EnvConfig, clientOptions: ApiClientOptions = {}) {
    this.config = config;
    this.authProvider = clientOptions.authProvider ?? new NoAuthProvider();
    this.enableCorrelationId = clientOptions.enableCorrelationId ?? true;
    this.logErrors = clientOptions.logErrors ?? true;
    this.maxRetries = clientOptions.maxRetries ?? 0;
    this.retryDelayMs = clientOptions.retryDelayMs ?? 200;
    this.retryOnStatuses = new Set(clientOptions.retryOnStatuses ?? DEFAULT_RETRY_STATUSES);
    this.sleepFn = clientOptions.sleepFn ?? sleep;
    this.circuitBreaker = clientOptions.circuitBreaker;
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.config.baseUrl}${cleanPath}`;
  }

  private mergeOptions(options?: RequestOptions): {
    merged: RequestOptions;
    correlationId?: string;
  } {
    const authHeaders = this.authProvider.getHeaders();
    const correlationId = this.enableCorrelationId ? generateCorrelationId() : undefined;

    const headers: Record<string, string> = {
      ...this.config.standardHeaders,
      ...authHeaders,
      ...(correlationId ? { 'X-Request-ID': correlationId } : {}),
      ...options?.headers,
    };

    const merged: RequestOptions = {
      timeout: this.config.timeout,
      ...options,
      headers,
    };

    return { merged, correlationId };
  }

  private parseResponse<T>(response: RefinedResponse<ResponseType>): T | null {
    if (response.body && response.status !== 204) {
      try {
        return response.json() as unknown as T;
      } catch {
        return null;
      }
    }
    return null;
  }

  private executeWithRetry(
    requestFn: (merged: RequestOptions) => RefinedResponse<ResponseType>,
    options?: RequestOptions
  ): { response: RefinedResponse<ResponseType>; merged: RequestOptions; correlationId?: string } {
    if (this.circuitBreaker && !this.circuitBreaker.allowRequest()) {
      throw new CircuitOpenError();
    }

    const retries = options?.maxRetries ?? this.maxRetries;
    let attempt = 0;

    while (true) {
      const { merged, correlationId } = this.mergeOptions(options);
      const response = requestFn(merged);

      if (attempt >= retries || !this.retryOnStatuses.has(response.status)) {
        return { response, merged, correlationId };
      }

      const backoffSec = (this.retryDelayMs * Math.pow(2, attempt)) / 1000;
      this.sleepFn(backoffSec);
      attempt++;
    }
  }

  private handleResponse<T>(
    method: string,
    url: string,
    response: RefinedResponse<ResponseType>,
    options?: RequestOptions,
    correlationId?: string
  ): TypedResponse<T> {
    const endpointTag = options?.tags?.endpoint ?? url;
    recordApiMetrics(response, endpointTag);

    if (this.circuitBreaker) {
      if (response.status >= 500 || response.status === 0) {
        this.circuitBreaker.recordFailure();
      } else {
        this.circuitBreaker.recordSuccess();
      }
    }

    if (this.logErrors && (response.status >= 400 || response.status === 0)) {
      const bodyPreview =
        typeof response.body === 'string' ? response.body.slice(0, 300) : '[binary/empty]';
      console.error(
        JSON.stringify({
          level: 'error',
          method,
          url,
          status: response.status,
          durationMs: response.timings.duration,
          correlationId,
          body: bodyPreview,
        })
      );
    }

    const data = this.parseResponse<T>(response);
    return { response, data };
  }

  private serializeBody<P>(payload: P): string {
    return typeof payload === 'string' ? payload : JSON.stringify(payload);
  }

  public get<T>(path: string, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const { response, merged, correlationId } = this.executeWithRetry(
      (m) => http.get(url, m) as unknown as RefinedResponse<ResponseType>,
      options
    );
    return this.handleResponse<T>('GET', url, response, merged, correlationId);
  }

  public post<P, T>(path: string, payload: P, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const body = this.serializeBody(payload);
    const { response, merged, correlationId } = this.executeWithRetry(
      (m) => http.post(url, body, m) as unknown as RefinedResponse<ResponseType>,
      options
    );
    return this.handleResponse<T>('POST', url, response, merged, correlationId);
  }

  public put<P, T>(path: string, payload: P, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const body = this.serializeBody(payload);
    const { response, merged, correlationId } = this.executeWithRetry(
      (m) => http.put(url, body, m) as unknown as RefinedResponse<ResponseType>,
      options
    );
    return this.handleResponse<T>('PUT', url, response, merged, correlationId);
  }

  public patch<P, T>(path: string, payload: P, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const body = this.serializeBody(payload);
    const { response, merged, correlationId } = this.executeWithRetry(
      (m) => http.patch(url, body, m) as unknown as RefinedResponse<ResponseType>,
      options
    );
    return this.handleResponse<T>('PATCH', url, response, merged, correlationId);
  }

  public del<T>(path: string, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const { response, merged, correlationId } = this.executeWithRetry(
      (m) => http.del(url, null, m) as unknown as RefinedResponse<ResponseType>,
      options
    );
    return this.handleResponse<T>('DELETE', url, response, merged, correlationId);
  }
}
