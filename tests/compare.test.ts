import { describe, it, expect } from 'vitest';
import { compareSummaries } from '../scripts/compare-baseline.mjs';

describe('compareSummaries', () => {
  const baseline = {
    metrics: {
      http_req_duration: { values: { 'p(95)': 100 } },
      http_req_failed: { values: { rate: 0.01 } },
    },
  };

  it('returns empty findings when within thresholds', () => {
    const current = {
      metrics: {
        http_req_duration: { values: { 'p(95)': 115 } },
        http_req_failed: { values: { rate: 0.015 } },
      },
    };
    expect(compareSummaries(baseline, current)).toEqual([]);
  });

  it('flags p95 latency regression above limit', () => {
    const current = {
      metrics: {
        http_req_duration: { values: { 'p(95)': 135 } },
        http_req_failed: { values: { rate: 0.01 } },
      },
    };
    const findings = compareSummaries(baseline, current, { maxP95RegressionPct: 20 });
    expect(findings).toHaveLength(1);
    expect(findings[0].metric).toBe('http_req_duration.p(95)');
  });

  it('flags error rate increase above delta', () => {
    const current = {
      metrics: {
        http_req_duration: { values: { 'p(95)': 100 } },
        http_req_failed: { values: { rate: 0.05 } },
      },
    };
    const findings = compareSummaries(baseline, current, { maxErrorRateDelta: 0.01 });
    expect(findings).toHaveLength(1);
    expect(findings[0].metric).toBe('http_req_failed.rate');
  });
});
