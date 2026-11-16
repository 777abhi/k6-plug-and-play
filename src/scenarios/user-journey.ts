import { Options } from 'k6/options';
import { check, group, sleep } from 'k6';
import { ApiClient } from '../libs/client.js';
import { getEnvConfig } from '../config/env.js';
import { buildOptions } from '../config/profiles.js';
import { createAuthProviderFromEnv } from '../libs/auth.js';
import { DataGenerator } from '../libs/data.js';
import { createSummaryHandler } from '../libs/reporting.js';

export const options: Options = buildOptions({
  endpointThresholds: [
    { endpointTag: 'journey_create_user', p95Ms: 400, maxErrorRate: 0.01 },
    { endpointTag: 'journey_patch_user', p95Ms: 400, maxErrorRate: 0.01 },
    { endpointTag: 'journey_delete_user', p95Ms: 300, maxErrorRate: 0.01 },
  ],
});

const envConfig = getEnvConfig();
const authProvider = createAuthProviderFromEnv();
const apiClient = new ApiClient(envConfig, {
  authProvider,
  maxRetries: 1,
  retryDelayMs: 100,
});

interface UserRecord {
  id: number;
  name: string;
  email: string;
}

export default function () {
  let createdId: number | null = null;

  group('1. Create user', () => {
    const res = apiClient.post<{ name: string; email: string }, UserRecord>(
      'users',
      {
        name: `Journey ${DataGenerator.randomString(6)}`,
        email: DataGenerator.randomEmail(),
      },
      { tags: { endpoint: 'journey_create_user' } }
    );

    const ok = check(res.response, {
      'create user status is 201': (r) => r.status === 201,
      'create user returns id': () => res.data?.id !== undefined,
    });

    if (ok && res.data) {
      createdId = res.data.id;
    }
  });

  sleep(0.5);

  if (createdId !== null) {
    group('2. Update user (PATCH)', () => {
      const res = apiClient.patch<{ name: string }, UserRecord>(
        `users/${createdId}`,
        { name: `Updated ${DataGenerator.randomString(4)}` },
        { tags: { endpoint: 'journey_patch_user' } }
      );

      check(res.response, {
        'patch user status is 200': (r) => r.status === 200,
      });
    });

    sleep(0.5);

    group('3. Delete user', () => {
      const res = apiClient.del<null>(`users/${createdId}`, {
        tags: { endpoint: 'journey_delete_user' },
      });

      check(res.response, {
        'delete user status is 204': (r) => r.status === 204,
      });
    });
  }

  sleep(1);
}

export const handleSummary = createSummaryHandler({
  title: 'User CRUD Journey Report',
  suiteName: 'user-journey',
});
