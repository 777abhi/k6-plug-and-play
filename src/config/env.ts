export interface EnvConfig {
  baseUrl: string;
  standardHeaders: Record<string, string>;
}

export type EnvironmentMap = {
  [key: string]: EnvConfig;
};

const environments: EnvironmentMap = {
  dev: {
    baseUrl: 'https://dev-api.example.com',
    standardHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
  staging: {
    baseUrl: 'https://staging-api.example.com',
    standardHeaders: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  },
};

export const getEnvConfig = (): EnvConfig => {
  const targetEnv = __ENV.TARGET_ENV || 'dev';
  const config = environments[targetEnv.toLowerCase()];

  if (!config) {
    throw new Error(`Configuration for environment '${targetEnv}' not found.`);
  }

  return config;
};
