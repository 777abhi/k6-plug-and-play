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
import { BearerAuthProvider } from '../src/libs/auth.js';
import { EnvConfig } from '../src/config/env.js';

const testConfig: EnvConfig = {
  name: 'test',
  baseUrl: 'https://api.test.local',
  standardHeaders: { 'Content-Type': 'application/json' },
  timeout: '10s',
};

const makeResponse = (status: number, jsonBody: unknown = null, rawBody = '') => ({
  status,
  body: jsonBody !== null ? JSON.stringify(jsonBody) : rawBody,
  timings: { duration: 12.5 },
  json: () => jsonBody,
});

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects auth headers and X-Request-ID on GET and parses JSON', () => {
    mockHttp.get.mockReturnValueOnce(makeResponse(200, { ok: true }));

    const client = new ApiClient(testConfig, {
      authProvider: new BearerAuthProvider('tok-123'),
    });
    const res = client.get<{ ok: boolean }>('health', { tags: { endpoint: 'health' } });

    expect(res.data).toEqual({ ok: true });
    expect(mockHttp.get).toHaveBeenCalledTimes(1);
    const [url, params] = mockHttp.get.mock.calls[0];
    expect(url).toBe('https://api.test.local/health');
    expect(params.headers.Authorization).toBe('Bearer tok-123');
    expect(params.headers['X-Request-ID']).toMatch(/^k6-/);
    expect(mockRecordApiMetrics).toHaveBeenCalledWith(expect.anything(), 'health');
  });

  it('supports POST, PUT, PATCH, and DELETE methods', () => {
    mockHttp.post.mockReturnValueOnce(makeResponse(201, { id: 1 }));
    mockHttp.put.mockReturnValueOnce(makeResponse(200, { id: 1, name: 'A' }));
    mockHttp.patch.mockReturnValueOnce(makeResponse(200, { id: 1, name: 'B' }));
    mockHttp.del.mockReturnValueOnce(makeResponse(204, null, ''));

    const client = new ApiClient(testConfig, { enableCorrelationId: false });

    expect(client.post('/users', { name: 'A' }).data).toEqual({ id: 1 });
    expect(client.put('/users/1', { name: 'A' }).data).toEqual({ id: 1, name: 'A' });
    expect(client.patch('/users/1', { name: 'B' }).data).toEqual({ id: 1, name: 'B' });
    expect(client.del('/users/1').data).toBeNull();
  });

  it('retries transient 503 responses with exponential backoff', () => {
    const sleepFn = vi.fn();
    mockHttp.get
      .mockReturnValueOnce(makeResponse(503, null, 'unavailable'))
      .mockReturnValueOnce(makeResponse(503, null, 'unavailable'))
      .mockReturnValueOnce(makeResponse(200, { recovered: true }));

    const client = new ApiClient(testConfig, {
      maxRetries: 2,
      retryDelayMs: 100,
      sleepFn,
      logErrors: false,
    });

    const res = client.get<{ recovered: boolean }>('health');
    expect(res.data).toEqual({ recovered: true });
    expect(mockHttp.get).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenNthCalledWith(1, 0.1);
    expect(sleepFn).toHaveBeenNthCalledWith(2, 0.2);
  });

  it('logs structured JSON error on 4xx/5xx responses', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockHttp.get.mockReturnValueOnce(makeResponse(500, null, 'boom'));

    const client = new ApiClient(testConfig, { logErrors: true });
    client.get('broken');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(logged.level).toBe('error');
    expect(logged.status).toBe(500);
    expect(logged.method).toBe('GET');
    errorSpy.mockRestore();
  });
});
