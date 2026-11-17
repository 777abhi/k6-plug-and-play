export interface EnvConfig {
  name: string;
  baseUrl: string;
  standardHeaders: Record<string, string>;
  timeout: string;
}

export type EnvironmentMap = {
  [key: string]: EnvConfig;
};

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

const environments: EnvironmentMap = {
  local: {
    name: 'local',
    baseUrl: 'http://localhost:3000',
    standardHeaders: { ...defaultHeaders },
    timeout: '30s',
  },
  dev: {
    name: 'dev',
    baseUrl: 'https://dev-api.example.com',
    standardHeaders: { ...defaultHeaders },
    timeout: '30s',
  },
  staging: {
    name: 'staging',
    baseUrl: 'https://staging-api.example.com',
    standardHeaders: { ...defaultHeaders },
    timeout: '30s',
  },
  prod: {
    name: 'prod',
    baseUrl: 'https://api.example.com',
    standardHeaders: { ...defaultHeaders },
    timeout: '30s',
  },
};

export type EnvSource = Record<string, string | undefined>;

export const resolveEnvSource = (envSource?: EnvSource): EnvSource => {
  if (envSource) {
    return envSource;
  }
  if (typeof __ENV !== 'undefined') {
    return __ENV;
  }
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
};

const validateBaseUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!/^https?:\/\/.+/.test(trimmed)) {
    throw new Error(`Invalid BASE_URL '${url}'. Must start with http:// or https://`);
  }
  return trimmed;
};

export const getEnvConfig = (envSource?: EnvSource): EnvConfig => {
  const env = resolveEnvSource(envSource);
  const targetEnv = (env.TARGET_ENV || 'dev').toLowerCase();
  const baseConfig = environments[targetEnv];

  if (!baseConfig) {
    const available = Object.keys(environments).join(', ');
    throw new Error(
      `Configuration for environment '${targetEnv}' not found. Available: ${available}`
    );
  }

  const baseUrl = validateBaseUrl(env.BASE_URL || baseConfig.baseUrl);
  const timeout = env.REQUEST_TIMEOUT || baseConfig.timeout;

  return {
    ...baseConfig,
    baseUrl,
    timeout,
    standardHeaders: { ...baseConfig.standardHeaders },
  };
};

export interface PartialEnvOverrides {
  baseUrl?: string;
  timeout?: string;
  standardHeaders?: Record<string, string>;
}

export const loadEnvConfigFromJson = (jsonText: string, envSource?: EnvSource): EnvConfig => {
  const env = resolveEnvSource(envSource);
  const targetEnv = (env.TARGET_ENV || 'dev').toLowerCase();
  const parsed = JSON.parse(jsonText) as Record<string, PartialEnvOverrides>;
  const jsonOverride = parsed[targetEnv];

  const base = getEnvConfig(envSource);
  if (!jsonOverride) {
    return base;
  }

  const resolvedBaseUrl = validateBaseUrl(env.BASE_URL || jsonOverride.baseUrl || base.baseUrl);
  const resolvedTimeout = env.REQUEST_TIMEOUT || jsonOverride.timeout || base.timeout;

  return {
    ...base,
    baseUrl: resolvedBaseUrl,
    timeout: resolvedTimeout,
    standardHeaders: {
      ...base.standardHeaders,
      ...jsonOverride.standardHeaders,
    },
  };
};
