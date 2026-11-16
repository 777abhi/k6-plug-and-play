import { describe, it, expect } from 'vitest';
import { getEnvConfig } from '../src/config/env.js';

describe('getEnvConfig', () => {
  it('defaults to dev environment when TARGET_ENV is not set', () => {
    const config = getEnvConfig({});
    expect(config.name).toBe('dev');
    expect(config.baseUrl).toBe('https://dev-api.example.com');
    expect(config.timeout).toBe('30s');
  });

  it('selects staging environment case-insensitively', () => {
    const config = getEnvConfig({ TARGET_ENV: 'STAGING' });
    expect(config.name).toBe('staging');
    expect(config.baseUrl).toBe('https://staging-api.example.com');
  });

  it('applies BASE_URL and REQUEST_TIMEOUT overrides and strips trailing slash', () => {
    const config = getEnvConfig({
      TARGET_ENV: 'dev',
      BASE_URL: 'https://custom.api.internal/',
      REQUEST_TIMEOUT: '15s',
    });
    expect(config.baseUrl).toBe('https://custom.api.internal');
    expect(config.timeout).toBe('15s');
  });

  it('throws on unknown TARGET_ENV', () => {
    expect(() => getEnvConfig({ TARGET_ENV: 'qa' })).toThrow(/not found/);
  });

  it('throws on invalid BASE_URL', () => {
    expect(() => getEnvConfig({ TARGET_ENV: 'dev', BASE_URL: 'ftp://bad-url' })).toThrow(
      /Invalid BASE_URL/
    );
  });
});
