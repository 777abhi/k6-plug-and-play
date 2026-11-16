import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockHttp, mockSleep, mockRecordApiMetrics } = vi.hoisted(() => ({
  mockHttp: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
  mockSleep: vi.fn(),
  mockRecordApiMetrics: vi.fn(),
}));

vi.mock('k6', () => ({ sleep: mockSleep }));
vi.mock('k6/http', () => ({ default: mockHttp }));
vi.mock('../src/libs/metrics.js', () => ({
  recordApiMetrics: mockRecordApiMetrics,
}));

import { ApiClient } from '../src/libs/client.js';
import { GraphQLClient } from '../src/libs/graphql.js';
import { EnvConfig } from '../src/config/env.js';

const testConfig: EnvConfig = {
  name: 'test',
  baseUrl: 'https://api.test.local',
  standardHeaders: { 'Content-Type': 'application/json' },
  timeout: '10s',
};

describe('GraphQLClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends query with operationName, variables, and endpoint tag', () => {
    const payload = { data: { user: { id: '1', name: 'Alice' } } };
    mockHttp.post.mockReturnValueOnce({
      status: 200,
      body: JSON.stringify(payload),
      timings: { duration: 15 },
      json: () => payload,
    });

    const apiClient = new ApiClient(testConfig);
    const gql = new GraphQLClient(apiClient);
    const res = gql.query<{ user: { id: string; name: string } }, { id: string }>(
      'query GetUser($id: ID!) { user(id: $id) { id name } }',
      { id: '1' },
      'GetUser'
    );

    expect(res.data).toEqual({ user: { id: '1', name: 'Alice' } });
    expect(res.errors).toEqual([]);
    const [url, rawBody, params] = mockHttp.post.mock.calls[0];
    expect(url).toBe('https://api.test.local/graphql');
    expect(JSON.parse(rawBody)).toMatchObject({
      operationName: 'GetUser',
      variables: { id: '1' },
    });
    expect(params.tags.endpoint).toBe('gql_GetUser');
  });

  it('captures and logs GraphQL errors from response body', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const payload = {
      data: null,
      errors: [{ message: 'User not found' }],
    };
    mockHttp.post.mockReturnValueOnce({
      status: 200,
      body: JSON.stringify(payload),
      timings: { duration: 10 },
      json: () => payload,
    });

    const apiClient = new ApiClient(testConfig);
    const gql = new GraphQLClient(apiClient);
    const res = gql.mutate('mutation DeleteUser { deleteUser(id: "99") }', undefined, 'DeleteUser');

    expect(res.data).toBeNull();
    expect(res.errors).toEqual([{ message: 'User not found' }]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});
