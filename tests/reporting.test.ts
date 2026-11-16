import { describe, it, expect } from 'vitest';
import { buildHtmlReport, buildJunitXml, K6SummaryData } from '../src/libs/reporting.js';

const sampleSummary: K6SummaryData = {
  state: { testRunDurationMs: 12500 },
  metrics: {
    http_req_duration: {
      type: 'trend',
      values: { avg: 42.5, 'p(90)': 80.1, 'p(95)': 95.4, max: 140.0 },
      thresholds: { 'p(95)<200': { ok: true } },
    },
    http_req_failed: {
      type: 'rate',
      values: { rate: 0.05 },
      thresholds: { 'rate<0.01': { ok: false } },
    },
  },
  root_group: {
    checks: [
      { name: 'GET users status is 200', passes: 19, fails: 1 },
      { name: 'POST user status is 201', passes: 20, fails: 0 },
    ],
  },
};

describe('reporting helpers', () => {
  it('builds HTML report with thresholds, checks, and metrics', () => {
    const html = buildHtmlReport(sampleSummary, 'Test Report');
    expect(html).toContain('Test Report');
    expect(html).toContain('http_req_duration');
    expect(html).toContain('PASS');
    expect(html).toContain('FAIL');
    expect(html).toContain('GET users status is 200');
  });

  it('builds valid JUnit XML counting threshold and check failures', () => {
    const xml = buildJunitXml(sampleSummary, 'api-suite');
    expect(xml).toContain('<testsuite name="api-suite" tests="4" failures="2">');
    expect(xml).toContain('Threshold failed: http_req_failed rate&lt;0.01');
    expect(xml).toContain('1 check(s) failed out of 20');
  });
});
