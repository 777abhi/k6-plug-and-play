export interface MetricSummary {
  type?: string;
  contains?: string;
  values?: Record<string, number>;
  thresholds?: Record<string, { ok: boolean }>;
}

export interface CheckSummary {
  name: string;
  passes: number;
  fails: number;
}

export interface K6SummaryData {
  metrics?: Record<string, MetricSummary>;
  root_group?: {
    name?: string;
    checks?: CheckSummary[];
  };
  state?: {
    testRunDurationMs?: number;
  };
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const escapeXml = (value: string): string => escapeHtml(value).replace(/'/g, '&apos;');

const formatNumber = (val: number | undefined): string =>
  val === undefined ? '-' : val.toFixed(2);

export const buildHtmlReport = (data: K6SummaryData, title = 'k6 Performance Report'): string => {
  const metrics = data.metrics ?? {};
  const checks = data.root_group?.checks ?? [];
  const durationSec = ((data.state?.testRunDurationMs ?? 0) / 1000).toFixed(2);

  const thresholdRows: string[] = [];
  for (const [metricName, metric] of Object.entries(metrics)) {
    if (!metric.thresholds) continue;
    for (const [expr, result] of Object.entries(metric.thresholds)) {
      const badge = result.ok
        ? '<span class="badge pass">PASS</span>'
        : '<span class="badge fail">FAIL</span>';
      thresholdRows.push(
        `<tr><td>${escapeHtml(metricName)}</td><td><code>${escapeHtml(expr)}</code></td><td>${badge}</td></tr>`
      );
    }
  }

  const metricRows = Object.entries(metrics)
    .map(([name, metric]) => {
      const v = metric.values ?? {};
      return `<tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(metric.type ?? '-')}</td>
        <td>${formatNumber(v.count ?? v.passes)}</td>
        <td>${formatNumber(v.rate)}</td>
        <td>${formatNumber(v.avg)}</td>
        <td>${formatNumber(v['p(90)'])}</td>
        <td>${formatNumber(v['p(95)'])}</td>
        <td>${formatNumber(v.max)}</td>
      </tr>`;
    })
    .join('\n');

  const checkRows = checks
    .map((c) => {
      const total = c.passes + c.fails;
      const rate = total > 0 ? ((c.passes / total) * 100).toFixed(1) : '0.0';
      return `<tr><td>${escapeHtml(c.name)}</td><td>${c.passes}</td><td>${c.fails}</td><td>${rate}%</td></tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 2rem; color: #1f2937; background: #f9fafb; }
    h1, h2 { color: #111827; }
    .meta { color: #4b5563; margin-bottom: 1.5rem; }
    table { width: 100%; border-collapse: collapse; background: #fff; margin-bottom: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    th, td { padding: 0.6rem 0.8rem; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 0.9rem; }
    th { background: #f3f4f6; font-weight: 600; }
    .badge { padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
    .pass { background: #dcfce7; color: #166534; }
    .fail { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Test Duration: ${durationSec}s</div>

  <h2>Thresholds</h2>
  <table>
    <thead><tr><th>Metric</th><th>Threshold</th><th>Status</th></tr></thead>
    <tbody>${thresholdRows.join('\n') || '<tr><td colspan="3">No thresholds configured</td></tr>'}</tbody>
  </table>

  <h2>Checks</h2>
  <table>
    <thead><tr><th>Check</th><th>Passes</th><th>Fails</th><th>Pass Rate</th></tr></thead>
    <tbody>${checkRows || '<tr><td colspan="4">No checks recorded</td></tr>'}</tbody>
  </table>

  <h2>Metrics</h2>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Count</th><th>Rate</th><th>Avg</th><th>p(90)</th><th>p(95)</th><th>Max</th></tr></thead>
    <tbody>${metricRows || '<tr><td colspan="8">No metrics recorded</td></tr>'}</tbody>
  </table>
</body>
</html>`;
};

export const buildJunitXml = (data: K6SummaryData, suiteName = 'k6-performance'): string => {
  const metrics = data.metrics ?? {};
  const checks = data.root_group?.checks ?? [];
  const cases: string[] = [];
  let failures = 0;

  for (const [metricName, metric] of Object.entries(metrics)) {
    if (!metric.thresholds) continue;
    for (const [expr, result] of Object.entries(metric.thresholds)) {
      const name = escapeXml(`threshold: ${metricName} (${expr})`);
      if (result.ok) {
        cases.push(`    <testcase name="${name}" classname="${escapeXml(suiteName)}" />`);
      } else {
        failures++;
        cases.push(
          `    <testcase name="${name}" classname="${escapeXml(suiteName)}">\n` +
            `      <failure message="Threshold failed: ${escapeXml(metricName)} ${escapeXml(expr)}" />\n` +
            `    </testcase>`
        );
      }
    }
  }

  for (const check of checks) {
    const name = escapeXml(`check: ${check.name}`);
    if (check.fails === 0) {
      cases.push(`    <testcase name="${name}" classname="${escapeXml(suiteName)}" />`);
    } else {
      failures++;
      cases.push(
        `    <testcase name="${name}" classname="${escapeXml(suiteName)}">\n` +
          `      <failure message="${check.fails} check(s) failed out of ${check.passes + check.fails}" />\n` +
          `    </testcase>`
      );
    }
  }

  const total = cases.length;
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${escapeXml(suiteName)}" tests="${total}" failures="${failures}">
${cases.join('\n')}
  </testsuite>
</testsuites>
`;
};

export interface SummaryHandlerOptions {
  reportDir?: string;
  title?: string;
  suiteName?: string;
}

export const createSummaryHandler = (options: SummaryHandlerOptions = {}) => {
  const reportDir = options.reportDir ?? 'reports';
  const title = options.title ?? 'k6 Performance Report';
  const suiteName = options.suiteName ?? 'k6-performance';

  return (data: K6SummaryData): Record<string, string> => {
    return {
      [`${reportDir}/summary.html`]: buildHtmlReport(data, title),
      [`${reportDir}/summary.json`]: JSON.stringify(data, null, 2),
      [`${reportDir}/junit.xml`]: buildJunitXml(data, suiteName),
    };
  };
};
