import { describe, it, expect } from 'vitest';
import {
  buildArrivalRateOptions,
  buildEndpointThresholds,
  buildOptions,
  composeScenarios,
  getLoadProfile,
} from '../src/config/profiles.js';

describe('load profiles', () => {
  it('defaults to smoke profile', () => {
    const profile = getLoadProfile({});
    expect(profile.name).toBe('smoke');
    expect(profile.stages.length).toBeGreaterThan(0);
  });

  it('selects load, stress, and soak profiles', () => {
    expect(getLoadProfile({ LOAD_PROFILE: 'load' }).name).toBe('load');
    expect(getLoadProfile({ LOAD_PROFILE: 'stress' }).name).toBe('stress');
    expect(getLoadProfile({ LOAD_PROFILE: 'soak' }).name).toBe('soak');
  });

  it('throws on unknown LOAD_PROFILE', () => {
    expect(() => getLoadProfile({ LOAD_PROFILE: 'burst' })).toThrow(/Unknown LOAD_PROFILE/);
  });

  it('builds per-endpoint thresholds', () => {
    const thresholds = buildEndpointThresholds([
      { endpointTag: 'list_users', p95Ms: 250, maxErrorRate: 0.02 },
    ]);
    expect(thresholds['http_req_duration{endpoint:list_users}']).toEqual(['p(95)<250']);
    expect(thresholds['http_req_failed{endpoint:list_users}']).toEqual(['rate<0.02']);
  });

  it('merges profile thresholds with endpoint and extra thresholds', () => {
    const opts = buildOptions({
      envSource: { LOAD_PROFILE: 'load' },
      endpointThresholds: [{ endpointTag: 'orders', p95Ms: 400 }],
      extraThresholds: { business_errors: ['count<5'] },
    });
    expect(opts.thresholds?.http_req_failed).toEqual(['rate<0.01']);
    expect(opts.thresholds?.['http_req_duration{endpoint:orders}']).toEqual(['p(95)<400']);
    expect(opts.thresholds?.business_errors).toEqual(['count<5']);
  });

  it('builds constant-arrival-rate options', () => {
    const opts = buildArrivalRateOptions(
      { rate: 50, duration: '1m', preAllocatedVUs: 10 },
      { envSource: { LOAD_PROFILE: 'smoke' } }
    );
    expect(opts.scenarios?.constant_rps).toMatchObject({
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 10,
      maxVUs: 20,
    });
  });

  it('composes multiple dynamic scenarios with thresholds', () => {
    const opts = composeScenarios(
      {
        steady: { executor: 'constant-vus', vus: 5, duration: '30s' },
        spike: { executor: 'per-vu-iterations', vus: 10, iterations: 2, startTime: '30s' },
      },
      { endpointThresholds: [{ endpointTag: 'checkout', p95Ms: 300 }] }
    );
    expect(Object.keys(opts.scenarios ?? {})).toEqual(['steady', 'spike']);
    expect(opts.thresholds?.['http_req_duration{endpoint:checkout}']).toEqual(['p(95)<300']);
  });
});
