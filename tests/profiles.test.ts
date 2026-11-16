import { describe, it, expect } from 'vitest';
import { buildEndpointThresholds, buildOptions, getLoadProfile } from '../src/config/profiles.js';

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
});
