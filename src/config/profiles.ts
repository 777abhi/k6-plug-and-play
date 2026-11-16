import { Options, Stage } from 'k6/options';
import { EnvSource, resolveEnvSource } from './env.js';

export type LoadProfileName = 'smoke' | 'load' | 'stress' | 'soak';

export interface LoadProfile {
  name: LoadProfileName;
  stages: Stage[];
  defaultThresholds: Record<string, string[]>;
}

const PROFILES: Record<LoadProfileName, LoadProfile> = {
  smoke: {
    name: 'smoke',
    stages: [
      { duration: '5s', target: 2 },
      { duration: '10s', target: 2 },
      { duration: '5s', target: 0 },
    ],
    defaultThresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<500'],
      checks: ['rate>0.99'],
    },
  },
  load: {
    name: 'load',
    stages: [
      { duration: '30s', target: 10 },
      { duration: '2m', target: 10 },
      { duration: '30s', target: 0 },
    ],
    defaultThresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<300', 'p(99)<600'],
      checks: ['rate>0.99'],
    },
  },
  stress: {
    name: 'stress',
    stages: [
      { duration: '30s', target: 20 },
      { duration: '1m', target: 50 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 0 },
    ],
    defaultThresholds: {
      http_req_failed: ['rate<0.05'],
      http_req_duration: ['p(95)<800'],
      checks: ['rate>0.95'],
    },
  },
  soak: {
    name: 'soak',
    stages: [
      { duration: '1m', target: 15 },
      { duration: '15m', target: 15 },
      { duration: '1m', target: 0 },
    ],
    defaultThresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<400'],
      checks: ['rate>0.99'],
    },
  },
};

export const getLoadProfile = (envSource?: EnvSource): LoadProfile => {
  const env = resolveEnvSource(envSource);
  const rawName = (env.LOAD_PROFILE || 'smoke').toLowerCase() as LoadProfileName;
  const profile = PROFILES[rawName];

  if (!profile) {
    const available = Object.keys(PROFILES).join(', ');
    throw new Error(`Unknown LOAD_PROFILE '${rawName}'. Available: ${available}`);
  }

  return profile;
};

export interface EndpointThresholdSpec {
  endpointTag: string;
  p95Ms?: number;
  maxErrorRate?: number;
}

export const buildEndpointThresholds = (
  specs: EndpointThresholdSpec[]
): Record<string, string[]> => {
  const thresholds: Record<string, string[]> = {};

  for (const spec of specs) {
    if (spec.p95Ms !== undefined) {
      thresholds[`http_req_duration{endpoint:${spec.endpointTag}}`] = [`p(95)<${spec.p95Ms}`];
    }
    if (spec.maxErrorRate !== undefined) {
      thresholds[`http_req_failed{endpoint:${spec.endpointTag}}`] = [`rate<${spec.maxErrorRate}`];
    }
  }

  return thresholds;
};

export interface BuildOptionsParams {
  envSource?: EnvSource;
  endpointThresholds?: EndpointThresholdSpec[];
  extraThresholds?: Record<string, string[]>;
  overrides?: Partial<Options>;
}

export const buildOptions = (params: BuildOptionsParams = {}): Options => {
  const profile = getLoadProfile(params.envSource);
  const endpointThresholds = params.endpointThresholds
    ? buildEndpointThresholds(params.endpointThresholds)
    : {};

  return {
    stages: profile.stages,
    thresholds: {
      ...profile.defaultThresholds,
      ...endpointThresholds,
      ...params.extraThresholds,
    },
    ...params.overrides,
  };
};
