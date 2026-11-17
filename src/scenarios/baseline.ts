import { Options } from 'k6/options';
import { ApiClient } from '../libs/client.js';
import { getEnvConfig } from '../config/env.js';
import { buildOptions } from '../config/profiles.js';
import { createAuthProviderFromEnv } from '../libs/auth.js';
import { assertResponse } from '../libs/assertions.js';
import { DataGenerator, loadCsvData } from '../libs/data.js';
import { randomSleep } from '../libs/pacing.js';
import { createSummaryHandler } from '../libs/reporting.js';

export const options: Options = buildOptions({
  endpointThresholds: [
    { endpointTag: 'list_users', p95Ms: 300, maxErrorRate: 0.01 },
    { endpointTag: 'create_user', p95Ms: 500, maxErrorRate: 0.01 },
  ],
});

const envConfig = getEnvConfig();
const authProvider = createAuthProviderFromEnv();
const apiClient = new ApiClient(envConfig, { authProvider });

interface SeedUser extends Record<string, string> {
  name: string;
  email: string;
  role: string;
}

const seedUsers = loadCsvData<SeedUser>('seed-users', '../data/users.csv');

interface CreateUserPayload {
  name: string;
  email: string;
}

interface UserResponse {
  id: number;
  name: string;
  email: string;
}

export default function () {
  const getRes = apiClient.get<UserResponse[]>('users', {
    tags: { endpoint: 'list_users' },
  });
  assertResponse('GET users', getRes.response, {
    expectedStatus: 200,
    nonEmptyArray: true,
  });

  randomSleep(0.5, 1.2);

  const seed = DataGenerator.pickRandom(seedUsers);
  const payload: CreateUserPayload = {
    name: seed.name,
    email: DataGenerator.randomEmail(),
  };

  const postRes = apiClient.post<CreateUserPayload, UserResponse>('users', payload, {
    tags: { endpoint: 'create_user' },
  });
  assertResponse('POST user', postRes.response, {
    expectedStatus: 201,
    requiredFields: ['id', 'name', 'email'],
  });

  randomSleep(0.5, 1.2);
}

export const handleSummary = createSummaryHandler({
  title: 'Baseline API Performance Report',
  suiteName: 'baseline-api',
});
