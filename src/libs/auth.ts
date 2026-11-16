import http from 'k6/http';
import { EnvSource, resolveEnvSource } from '../config/env.js';

export interface AuthProvider {
  getHeaders(): Record<string, string>;
}

export class NoAuthProvider implements AuthProvider {
  public getHeaders(): Record<string, string> {
    return {};
  }
}

export class BearerAuthProvider implements AuthProvider {
  private readonly token: string;

  constructor(token: string) {
    if (!token) {
      throw new Error('BearerAuthProvider requires a non-empty token.');
    }
    this.token = token;
  }

  public getHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}` };
  }
}

export class ApiKeyAuthProvider implements AuthProvider {
  private readonly apiKey: string;
  private readonly headerName: string;

  constructor(apiKey: string, headerName = 'X-API-Key') {
    if (!apiKey) {
      throw new Error('ApiKeyAuthProvider requires a non-empty apiKey.');
    }
    this.apiKey = apiKey;
    this.headerName = headerName;
  }

  public getHeaders(): Record<string, string> {
    return { [this.headerName]: this.apiKey };
  }
}

export interface OAuth2Config {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  expirySkewSeconds?: number;
}

export interface TokenResponse {
  status: number;
  body: string | number[] | ArrayBuffer | null;
}

export type HttpPostFn = (
  url: string,
  body: Record<string, string>,
  params: { headers: Record<string, string> }
) => TokenResponse;

interface OAuth2TokenPayload {
  access_token?: string;
  expires_in?: number;
}

const defaultHttpPost: HttpPostFn = (url, body, params) => {
  return http.post(url, body, params);
};

export class OAuth2ClientCredentialsProvider implements AuthProvider {
  private readonly config: OAuth2Config;
  private readonly postFn: HttpPostFn;
  private readonly nowFn: () => number;
  private cachedToken: string | null = null;
  private expiresAtMs = 0;

  constructor(
    config: OAuth2Config,
    postFn: HttpPostFn = defaultHttpPost,
    nowFn: () => number = () => Date.now()
  ) {
    if (!config.tokenUrl || !config.clientId || !config.clientSecret) {
      throw new Error(
        'OAuth2ClientCredentialsProvider requires tokenUrl, clientId, and clientSecret.'
      );
    }
    this.config = config;
    this.postFn = postFn;
    this.nowFn = nowFn;
  }

  public getHeaders(): Record<string, string> {
    const skewMs = (this.config.expirySkewSeconds ?? 30) * 1000;
    if (this.cachedToken && this.nowFn() + skewMs < this.expiresAtMs) {
      return { Authorization: `Bearer ${this.cachedToken}` };
    }

    const formBody: Record<string, string> = {
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    };

    if (this.config.scope) {
      formBody.scope = this.config.scope;
    }

    const res = this.postFn(this.config.tokenUrl, formBody, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (res.status < 200 || res.status >= 300 || typeof res.body !== 'string') {
      throw new Error(`OAuth2 token request failed with status ${res.status}`);
    }

    const parsed = JSON.parse(res.body) as OAuth2TokenPayload;
    if (!parsed.access_token) {
      throw new Error('OAuth2 token response missing access_token');
    }

    const expiresInSec = parsed.expires_in ?? 300;
    this.cachedToken = parsed.access_token;
    this.expiresAtMs = this.nowFn() + expiresInSec * 1000;

    return { Authorization: `Bearer ${this.cachedToken}` };
  }
}

export const createAuthProviderFromEnv = (envSource?: EnvSource): AuthProvider => {
  const env = resolveEnvSource(envSource);
  const authType = (env.AUTH_TYPE || 'none').toLowerCase();

  switch (authType) {
    case 'none':
      return new NoAuthProvider();
    case 'bearer':
      return new BearerAuthProvider(env.AUTH_TOKEN || '');
    case 'apikey':
      return new ApiKeyAuthProvider(env.API_KEY || '', env.API_KEY_HEADER || 'X-API-Key');
    case 'oauth2':
      return new OAuth2ClientCredentialsProvider({
        tokenUrl: env.OAUTH_TOKEN_URL || '',
        clientId: env.OAUTH_CLIENT_ID || '',
        clientSecret: env.OAUTH_CLIENT_SECRET || '',
        scope: env.OAUTH_SCOPE,
      });
    default:
      throw new Error(
        `Unsupported AUTH_TYPE '${authType}'. Supported: none, bearer, apikey, oauth2`
      );
  }
};
