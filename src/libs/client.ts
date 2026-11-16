import http, { RefinedResponse, ResponseType } from 'k6/http';
import { EnvConfig } from '../config/env.js';
import { AuthProvider, NoAuthProvider } from './auth.js';
import { recordApiMetrics } from './metrics.js';

export interface RequestOptions {
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  timeout?: string;
  responseType?: ResponseType;
}

export interface ApiClientOptions {
  authProvider?: AuthProvider;
  enableCorrelationId?: boolean;
  logErrors?: boolean;
}

export interface TypedResponse<T> {
  response: RefinedResponse<ResponseType>;
  data: T | null;
}

const generateCorrelationId = (): string => {
  const rand = Math.random().toString(16).slice(2, 10);
  return `k6-${Date.now().toString(36)}-${rand}`;
};

export class ApiClient {
  private readonly config: EnvConfig;
  private readonly authProvider: AuthProvider;
  private readonly enableCorrelationId: boolean;
  private readonly logErrors: boolean;

  constructor(config: EnvConfig, clientOptions: ApiClientOptions = {}) {
    this.config = config;
    this.authProvider = clientOptions.authProvider ?? new NoAuthProvider();
    this.enableCorrelationId = clientOptions.enableCorrelationId ?? true;
    this.logErrors = clientOptions.logErrors ?? true;
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

  private handleResponse<T>(
    method: string,
    url: string,
    response: RefinedResponse<ResponseType>,
    options?: RequestOptions,
    correlationId?: string
  ): TypedResponse<T> {
    const endpointTag = options?.tags?.endpoint ?? url;
    recordApiMetrics(response, endpointTag);

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
    const { merged, correlationId } = this.mergeOptions(options);
    const response = http.get(url, merged) as unknown as RefinedResponse<ResponseType>;
    return this.handleResponse<T>('GET', url, response, merged, correlationId);
  }

  public post<P, T>(path: string, payload: P, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const { merged, correlationId } = this.mergeOptions(options);
    const response = http.post(
      url,
      this.serializeBody(payload),
      merged
    ) as unknown as RefinedResponse<ResponseType>;
    return this.handleResponse<T>('POST', url, response, merged, correlationId);
  }

  public put<P, T>(path: string, payload: P, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const { merged, correlationId } = this.mergeOptions(options);
    const response = http.put(
      url,
      this.serializeBody(payload),
      merged
    ) as unknown as RefinedResponse<ResponseType>;
    return this.handleResponse<T>('PUT', url, response, merged, correlationId);
  }

  public patch<P, T>(path: string, payload: P, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const { merged, correlationId } = this.mergeOptions(options);
    const response = http.patch(
      url,
      this.serializeBody(payload),
      merged
    ) as unknown as RefinedResponse<ResponseType>;
    return this.handleResponse<T>('PATCH', url, response, merged, correlationId);
  }

  public del<T>(path: string, options?: RequestOptions): TypedResponse<T> {
    const url = this.buildUrl(path);
    const { merged, correlationId } = this.mergeOptions(options);
    const response = http.del(url, null, merged) as unknown as RefinedResponse<ResponseType>;
    return this.handleResponse<T>('DELETE', url, response, merged, correlationId);
  }
}
