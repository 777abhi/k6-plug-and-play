import { describe, it, expect } from 'vitest';
import { getEnvConfig, loadEnvConfigFromJson } from '../src/config/env.js';

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

  it('merges JSON environment config with __ENV overrides', () => {
    const json = JSON.stringify({
      staging: {
        baseUrl: 'https://json-staging.example.com',
        timeout: '45s',
        standardHeaders: { 'X-Tenant': 'acme' },
      },
    });

    const fromJson = loadEnvConfigFromJson(json, { TARGET_ENV: 'staging' });
    expect(fromJson.baseUrl).toBe('https://json-staging.example.com');
    expect(fromJson.timeout).toBe('45s');
    expect(fromJson.standardHeaders['X-Tenant']).toBe('acme');

    const withEnvOverride = loadEnvConfigFromJson(json, {
      TARGET_ENV: 'staging',
      BASE_URL: 'https://ci-override.example.com',
    });
    expect(withEnvOverride.baseUrl).toBe('https://ci-override.example.com');
  });
});
