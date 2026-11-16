import { describe, it, expect, vi } from 'vitest';

vi.mock('k6/data', () => ({
  SharedArray: class<T> {
    constructor(_name: string, fn: () => T[]) {
      return fn();
    }
  },
}));

import { DataGenerator, parseCsv } from '../src/libs/data.js';

describe('data helpers', () => {
  it('parses CSV with headers and quoted commas', () => {
    const csv = `name,email,note\n"Doe, Jane",jane@example.com,"has ""quotes"""\nBob,bob@example.com,plain`;
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      { name: 'Doe, Jane', email: 'jane@example.com', note: 'has "quotes"' },
      { name: 'Bob', email: 'bob@example.com', note: 'plain' },
    ]);
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCsv('name,email\n')).toEqual([]);
  });

  it('generates valid synthetic data', () => {
    expect(DataGenerator.randomEmail('acme.io')).toMatch(/^user\.[a-z0-9]{8}@acme\.io$/);
    expect(DataGenerator.uuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    expect(DataGenerator.pickRandom(['a', 'b'])).toMatch(/^[ab]$/);
    const num = DataGenerator.randomInt(5, 10);
    expect(num).toBeGreaterThanOrEqual(5);
    expect(num).toBeLessThanOrEqual(10);
  });
});
