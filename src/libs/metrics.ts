import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import { RefinedResponse, ResponseType } from 'k6/http';

export const businessErrors = new Counter('business_errors');
export const apiDuration = new Trend('api_duration', true);
export const apiSuccessRate = new Rate('api_success_rate');
export const activeIterations = new Gauge('active_iterations');

export const recordApiMetrics = (
  response: RefinedResponse<ResponseType>,
  endpointTag: string,
  isSuccess?: boolean
): void => {
  const ok = isSuccess ?? (response.status >= 200 && response.status < 400);
  const tags = { endpoint: endpointTag, status: String(response.status) };

  apiDuration.add(response.timings.duration, tags);
  apiSuccessRate.add(ok, tags);

  if (!ok) {
    businessErrors.add(1, tags);
  }
};
