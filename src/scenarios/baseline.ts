import { Options } from 'k6/options';
import { check, sleep } from 'k6';
import { ApiClient } from '../libs/client.js';
import { getEnvConfig } from '../config/env.js';

export const options: Options = {
  stages: [
    { duration: '5s', target: 10 }, // Ramp up to 10 VUs
    { duration: '20s', target: 10 }, // Stay at 10 VUs for 20 seconds
    { duration: '5s', target: 0 }, // Ramp down to 0 VUs
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // Error rate < 1%
    http_req_duration: ['p(95)<200'], // p95 < 200ms
  },
};

const envConfig = getEnvConfig();
const apiClient = new ApiClient(envConfig);

// Define a sample payload type
interface CreateUserPayload {
  name: string;
  email: string;
}

// Define a sample response type
interface UserResponse {
  id: number;
  name: string;
  email: string;
}

export default function () {
  // GET request
  const getRes = apiClient.get<UserResponse[]>('users');
  check(getRes.response, {
    'GET users status is 200': (r) => r.status === 200,
  });

  // verify typing on data
  const data = getRes.data;
  if (data && data.length > 0) {
      // data[0].id is typed
  }

  sleep(1);

  // POST request
  const payload: CreateUserPayload = {
    name: 'Test User',
    email: 'test@example.com',
  };
  const postRes = apiClient.post<CreateUserPayload, UserResponse>('users', payload);
  check(postRes.response, {
    'POST user status is 201': (r) => r.status === 201,
  });

  sleep(1);
}
