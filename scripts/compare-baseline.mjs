import { readFileSync } from 'node:fs';

export const compareSummaries = (baseline, current, options = {}) => {
  const maxP95RegressionPct = options.maxP95RegressionPct ?? 20;
  const maxErrorRateDelta = options.maxErrorRateDelta ?? 0.01;
  const findings = [];

  const baseDuration = baseline?.metrics?.http_req_duration?.values?.['p(95)'];
  const currDuration = current?.metrics?.http_req_duration?.values?.['p(95)'];

  if (typeof baseDuration === 'number' && baseDuration > 0 && typeof currDuration === 'number') {
    const pctChange = ((currDuration - baseDuration) / baseDuration) * 100;
    if (pctChange > maxP95RegressionPct) {
      findings.push({
        metric: 'http_req_duration.p(95)',
        reason: `Regressed by ${pctChange.toFixed(1)}% (${baseDuration.toFixed(2)}ms -> ${currDuration.toFixed(2)}ms, limit ${maxP95RegressionPct}%)`,
      });
    }
  }

  const baseErr = baseline?.metrics?.http_req_failed?.values?.rate;
  const currErr = current?.metrics?.http_req_failed?.values?.rate;

  if (typeof baseErr === 'number' && typeof currErr === 'number') {
    const delta = currErr - baseErr;
    if (delta > maxErrorRateDelta) {
      findings.push({
        metric: 'http_req_failed.rate',
        reason: `Error rate increased by ${(delta * 100).toFixed(2)}% (${(baseErr * 100).toFixed(2)}% -> ${(currErr * 100).toFixed(2)}%, limit ${(maxErrorRateDelta * 100).toFixed(2)}%)`,
      });
    }
  }

  return findings;
};

const isMain = process.argv[1] && process.argv[1].endsWith('compare-baseline.mjs');
if (isMain) {
  const [baselinePath, currentPath] = process.argv.slice(2);
  if (!baselinePath || !currentPath) {
    console.error('Usage: npm run compare:baseline <baseline-summary.json> <current-summary.json>');
    process.exit(1);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const current = JSON.parse(readFileSync(currentPath, 'utf8'));
  const findings = compareSummaries(baseline, current, {
    maxP95RegressionPct: Number(process.env.MAX_P95_REGRESSION_PCT || 20),
    maxErrorRateDelta: Number(process.env.MAX_ERROR_RATE_DELTA || 0.01),
  });

  if (findings.length > 0) {
    console.error('Performance regression detected:');
    for (const f of findings) {
      console.error(`  - [${f.metric}] ${f.reason}`);
    }
    process.exit(1);
  }

  console.log('No performance regressions detected against baseline.');
}
