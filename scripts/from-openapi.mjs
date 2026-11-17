import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SUPPORTED_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

export const generateScenarioFromOpenApi = (spec, scenarioName) => {
  const paths = spec?.paths || {};
  const operations = [];

  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, op] of Object.entries(pathItem)) {
      const lower = method.toLowerCase();
      if (!SUPPORTED_METHODS.has(lower)) continue;
      const tag =
        (op && typeof op === 'object' && op.operationId) ||
        `${lower}_${rawPath.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
      const k6Path = rawPath.replace(/\{([^}]+)\}/g, '1').replace(/^\/+/, '');
      operations.push({ method: lower, path: k6Path, tag });
    }
  }

  if (operations.length === 0) {
    throw new Error('No supported HTTP operations found in OpenAPI spec.');
  }

  const thresholdLines = operations
    .map((op) => `    { endpointTag: '${op.tag}', p95Ms: 400, maxErrorRate: 0.01 },`)
    .join('\n');

  const callBlocks = operations
    .map((op) => {
      if (op.method === 'get') {
        return `    const ${op.tag}Res = apiClient.get<unknown>('${op.path}', { tags: { endpoint: '${op.tag}' } });
    check(${op.tag}Res.response, { '${op.tag} ok': (r) => r.status >= 200 && r.status < 400 });`;
      }
      if (op.method === 'delete') {
        return `    const ${op.tag}Res = apiClient.del<unknown>('${op.path}', { tags: { endpoint: '${op.tag}' } });
    check(${op.tag}Res.response, { '${op.tag} ok': (r) => r.status >= 200 && r.status < 400 });`;
      }
      return `    const ${op.tag}Res = apiClient.${op.method}<Record<string, unknown>, unknown>('${op.path}', {}, { tags: { endpoint: '${op.tag}' } });
    check(${op.tag}Res.response, { '${op.tag} ok': (r) => r.status >= 200 && r.status < 400 });`;
    })
    .join('\n\n');

  const content = `import { Options } from 'k6/options';
import { check, group, sleep } from 'k6';
import { ApiClient } from '../libs/client.js';
import { getEnvConfig } from '../config/env.js';
import { buildOptions } from '../config/profiles.js';
import { createAuthProviderFromEnv } from '../libs/auth.js';
import { createSummaryHandler } from '../libs/reporting.js';

export const options: Options = buildOptions({
  endpointThresholds: [
${thresholdLines}
  ],
});

const envConfig = getEnvConfig();
const authProvider = createAuthProviderFromEnv();
const apiClient = new ApiClient(envConfig, { authProvider, maxRetries: 1 });

export default function () {
  group('${scenarioName} OpenAPI suite', () => {
${callBlocks}
  });

  sleep(1);
}

export const handleSummary = createSummaryHandler({
  title: '${scenarioName} OpenAPI Performance Report',
  suiteName: '${scenarioName}',
});
`;

  return { content, operationCount: operations.length };
};

const isMain = process.argv[1] && process.argv[1].endsWith('from-openapi.mjs');
if (isMain) {
  const specArg = process.argv[2];
  const scenarioName = process.argv[3];

  if (!specArg || !scenarioName || !/^[a-z0-9-]+$/.test(scenarioName)) {
    console.error('Usage: npm run new:from-openapi <openapi.json> <kebab-case-scenario-name>');
    process.exit(1);
  }

  const specPath = join(process.cwd(), specArg);
  if (!existsSync(specPath)) {
    console.error(`OpenAPI spec not found: ${specPath}`);
    process.exit(1);
  }

  const targetPath = join(process.cwd(), 'src', 'scenarios', `${scenarioName}.ts`);
  if (existsSync(targetPath)) {
    console.error(`Scenario already exists: ${targetPath}`);
    process.exit(1);
  }

  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const { content, operationCount } = generateScenarioFromOpenApi(spec, scenarioName);
  writeFileSync(targetPath, content, 'utf8');
  console.log(
    `Generated scenario from OpenAPI (${operationCount} operations): src/scenarios/${scenarioName}.ts`
  );
}
