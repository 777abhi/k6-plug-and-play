import { check } from 'k6';
import { RefinedResponse, ResponseType } from 'k6/http';

export interface AssertResponseOptions {
  expectedStatus?: number | number[];
  maxDurationMs?: number;
  requiredFields?: string[];
  nonEmptyArray?: boolean;
}

export const assertResponse = (
  name: string,
  response: RefinedResponse<ResponseType>,
  options: AssertResponseOptions = {}
): boolean => {
  const checks: Record<string, (r: RefinedResponse<ResponseType>) => boolean> = {};

  if (options.expectedStatus !== undefined) {
    const allowed = Array.isArray(options.expectedStatus)
      ? options.expectedStatus
      : [options.expectedStatus];
    checks[`${name}: status in [${allowed.join(',')}]`] = (r) => allowed.includes(r.status);
  }

  if (options.maxDurationMs !== undefined) {
    const limit = options.maxDurationMs;
    checks[`${name}: duration < ${limit}ms`] = (r) => r.timings.duration < limit;
  }

  if (options.requiredFields && options.requiredFields.length > 0) {
    const fields = options.requiredFields;
    checks[`${name}: has fields [${fields.join(', ')}]`] = (r) => {
      try {
        const parsed = r.json() as Record<string, unknown> | null;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return false;
        }
        return fields.every((f) => f in parsed && parsed[f] !== undefined);
      } catch {
        return false;
      }
    };
  }

  if (options.nonEmptyArray) {
    checks[`${name}: non-empty array`] = (r) => {
      try {
        const parsed = r.json() as unknown;
        return Array.isArray(parsed) && parsed.length > 0;
      } catch {
        return false;
      }
    };
  }

  return check(response, checks);
};
