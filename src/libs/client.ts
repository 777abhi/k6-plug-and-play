import http, { RefinedResponse, ResponseType } from 'k6/http';
import { EnvConfig } from '../config/env.js';

export interface RequestOptions {
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  timeout?: string;
  responseType?: ResponseType;
}

export interface TypedResponse<T> {
  response: RefinedResponse<ResponseType>;
  data: T | null;
}

export class ApiClient {
  private config: EnvConfig;

  constructor(config: EnvConfig) {
    this.config = config;
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.config.baseUrl}${cleanPath}`;
  }

  private mergeOptions(options?: RequestOptions): RequestOptions {
    const defaultOptions: RequestOptions = {
      headers: { ...this.config.standardHeaders },
    };

    if (options?.headers) {
      defaultOptions.headers = { ...defaultOptions.headers, ...options.headers };
    }

    return { ...defaultOptions, ...options };
  }

  private parseResponse<T>(response: RefinedResponse<ResponseType>): T | null {
    if (response.body && response.status !== 204) {
      try {
        return response.json() as unknown as T;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  public get<T>(
    path: string,
    options?: RequestOptions
  ): TypedResponse<T> {
    const url = this.buildUrl(path);
    const mergedOptions = this.mergeOptions(options);
    const response = http.get(url, mergedOptions) as unknown as RefinedResponse<ResponseType>;
    const data = this.parseResponse<T>(response);
    return { response, data };
  }

  public post<P, T>(
    path: string,
    payload: P,
    options?: RequestOptions
  ): TypedResponse<T> {
    const url = this.buildUrl(path);
    const mergedOptions = this.mergeOptions(options);
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const response = http.post(url, body, mergedOptions) as unknown as RefinedResponse<ResponseType>;
    const data = this.parseResponse<T>(response);
    return { response, data };
  }

  public put<P, T>(
    path: string,
    payload: P,
    options?: RequestOptions
  ): TypedResponse<T> {
    const url = this.buildUrl(path);
    const mergedOptions = this.mergeOptions(options);
    const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const response = http.put(url, body, mergedOptions) as unknown as RefinedResponse<ResponseType>;
    const data = this.parseResponse<T>(response);
    return { response, data };
  }

  public del<T>(
    path: string,
    options?: RequestOptions
  ): TypedResponse<T> {
    const url = this.buildUrl(path);
    const mergedOptions = this.mergeOptions(options);
    const response = http.del(url, null, mergedOptions) as unknown as RefinedResponse<ResponseType>;
    const data = this.parseResponse<T>(response);
    return { response, data };
  }
}
