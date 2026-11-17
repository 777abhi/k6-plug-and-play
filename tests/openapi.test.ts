import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateScenarioFromOpenApi } from '../scripts/from-openapi.mjs';

describe('generateScenarioFromOpenApi', () => {
  it('generates scenario TypeScript code from sample OpenAPI spec', () => {
    const spec = JSON.parse(
      readFileSync(join(process.cwd(), 'data', 'sample-openapi.json'), 'utf8')
    ) as Record<string, unknown>;

    const { content, operationCount } = generateScenarioFromOpenApi(spec, 'sample-api');

    expect(operationCount).toBe(5);
    expect(content).toContain("endpointTag: 'getHealth'");
    expect(content).toContain("endpointTag: 'listUsers'");
    expect(content).toContain("apiClient.patch<Record<string, unknown>, unknown>('users/1'");
    expect(content).toContain("apiClient.del<unknown>('users/1'");
  });

  it('throws when spec contains no supported operations', () => {
    expect(() => generateScenarioFromOpenApi({ paths: {} }, 'empty')).toThrow(
      /No supported HTTP operations/
    );
  });
});
