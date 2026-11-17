import { describe, it, expect, vi } from 'vitest';
import { RefinedResponse, ResponseType } from 'k6/http';

vi.mock('k6', () => ({
  check: <T>(val: T, sets: Record<string, (v: T) => boolean>): boolean =>
    Object.values(sets).every((fn) => fn(val)),
}));

import { assertResponse } from '../src/libs/assertions.js';

const makeResponse = (
  status: number,
  duration: number,
  body: unknown
): RefinedResponse<ResponseType> =>
  ({
    status,
    timings: { duration },
    json: () => body,
  }) as unknown as RefinedResponse<ResponseType>;

describe('assertResponse', () => {
  it('passes when status, duration, and requiredFields match', () => {
    const res = makeResponse(201, 45, { id: 1, email: 'a@b.com' });
    const ok = assertResponse('create_user', res, {
      expectedStatus: [200, 201],
      maxDurationMs: 100,
      requiredFields: ['id', 'email'],
    });
    expect(ok).toBe(true);
  });

  it('fails when required field is missing or duration exceeds threshold', () => {
    const res = makeResponse(200, 150, { id: 1 });
    expect(
      assertResponse('get_user', res, {
        expectedStatus: 200,
        maxDurationMs: 100,
        requiredFields: ['id', 'email'],
      })
    ).toBe(false);
  });

  it('validates nonEmptyArray responses', () => {
    expect(
      assertResponse('list_users', makeResponse(200, 20, [{ id: 1 }]), {
        expectedStatus: 200,
        nonEmptyArray: true,
      })
    ).toBe(true);

    expect(
      assertResponse('list_users', makeResponse(200, 20, []), {
        expectedStatus: 200,
        nonEmptyArray: true,
      })
    ).toBe(false);
  });
});
