import { K6SummaryData } from '../src/libs/reporting.js';

export interface CompareOptions {
  maxP95RegressionPct?: number;
  maxErrorRateDelta?: number;
}

export interface RegressionFinding {
  metric: string;
  reason: string;
}

export declare function compareSummaries(
  baseline: K6SummaryData,
  current: K6SummaryData,
  options?: CompareOptions
): RegressionFinding[];
