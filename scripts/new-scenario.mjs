import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rawName = process.argv[2];

if (!rawName || !/^[a-z0-9-]+$/.test(rawName)) {
  console.error('Usage: npm run new:scenario <kebab-case-name>');
  process.exit(1);
}

const targetPath = join(process.cwd(), 'src', 'scenarios', `${rawName}.ts`);
if (existsSync(targetPath)) {
  console.error(`Scenario already exists: ${targetPath}`);
  process.exit(1);
}

const template = `import { Options } from 'k6/options';
import { check, group, sleep } from 'k6';
import { ApiClient } from '../libs/client.js';
import { getEnvConfig } from '../config/env.js';
import { buildOptions } from '../config/profiles.js';
import { createAuthProviderFromEnv } from '../libs/auth.js';
import { createSummaryHandler } from '../libs/reporting.js';

export const options: Options = buildOptions({
  endpointThresholds: [
    { endpointTag: '${rawName}_health', p95Ms: 250, maxErrorRate: 0.01 },
  ],
});

const envConfig = getEnvConfig();
const authProvider = createAuthProviderFromEnv();
const apiClient = new ApiClient(envConfig, { authProvider, maxRetries: 1 });

export default function () {
  group('${rawName} workflow', () => {
    const res = apiClient.get<{ status: string }>('health', {
      tags: { endpoint: '${rawName}_health' },
    });

    check(res.response, {
      'status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}

export const handleSummary = createSummaryHandler({
  title: '${rawName} Performance Report',
  suiteName: '${rawName}',
});
`;

writeFileSync(targetPath, template, 'utf8');
console.log(`Created scenario: src/scenarios/${rawName}.ts`);
console.log(`Build with: npm run build`);
console.log(`Run with:   k6 run dist/${rawName}.js`);
