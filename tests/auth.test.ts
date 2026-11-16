import { describe, it, expect, vi } from 'vitest';

vi.mock('k6/http', () => ({
  default: { post: vi.fn() },
}));

import {
  ApiKeyAuthProvider,
  BearerAuthProvider,
  NoAuthProvider,
  OAuth2ClientCredentialsProvider,
  createAuthProviderFromEnv,
} from '../src/libs/auth.js';

describe('Auth providers', () => {
  it('NoAuthProvider returns empty headers', () => {
    expect(new NoAuthProvider().getHeaders()).toEqual({});
  });

  it('BearerAuthProvider returns Authorization header', () => {
    const provider = new BearerAuthProvider('secret-jwt');
    expect(provider.getHeaders()).toEqual({ Authorization: 'Bearer secret-jwt' });
  });

  it('ApiKeyAuthProvider returns custom header', () => {
    const provider = new ApiKeyAuthProvider('key-123', 'X-Custom-Key');
    expect(provider.getHeaders()).toEqual({ 'X-Custom-Key': 'key-123' });
  });

  it('OAuth2ClientCredentialsProvider caches token until near expiry and refreshes', () => {
    let currentTime = 1_000_000;
    let callCount = 0;
    const mockPost = vi.fn(() => {
      callCount++;
      return {
        status: 200,
        body: JSON.stringify({ access_token: `token-${callCount}`, expires_in: 120 }),
      };
    });

    const provider = new OAuth2ClientCredentialsProvider(
      {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'cid',
        clientSecret: 'csecret',
        expirySkewSeconds: 30,
      },
      mockPost,
      () => currentTime
    );

    expect(provider.getHeaders()).toEqual({ Authorization: 'Bearer token-1' });
    expect(mockPost).toHaveBeenCalledTimes(1);

    // Within valid window (60s elapsed, 60s left > 30s skew) -> cached
    currentTime += 60_000;
    expect(provider.getHeaders()).toEqual({ Authorization: 'Bearer token-1' });
    expect(mockPost).toHaveBeenCalledTimes(1);

    // Within skew window (95s elapsed, 25s left < 30s skew) -> refreshes
    currentTime += 35_000;
    expect(provider.getHeaders()).toEqual({ Authorization: 'Bearer token-2' });
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it('createAuthProviderFromEnv selects provider based on AUTH_TYPE', () => {
    expect(createAuthProviderFromEnv({}).getHeaders()).toEqual({});
    expect(
      createAuthProviderFromEnv({ AUTH_TYPE: 'bearer', AUTH_TOKEN: 'abc' }).getHeaders()
    ).toEqual({ Authorization: 'Bearer abc' });
    expect(createAuthProviderFromEnv({ AUTH_TYPE: 'apikey', API_KEY: 'xyz' }).getHeaders()).toEqual(
      { 'X-API-Key': 'xyz' }
    );
  });
});
