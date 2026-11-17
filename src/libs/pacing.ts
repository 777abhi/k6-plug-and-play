import { sleep } from 'k6';

export const randomSleep = (
  minSec: number,
  maxSec: number,
  sleepFn: (seconds: number) => void = sleep,
  randFn: () => number = Math.random
): number => {
  if (minSec < 0 || maxSec < minSec) {
    throw new Error(`Invalid sleep bounds: minSec=${minSec}, maxSec=${maxSec}`);
  }
  const duration = minSec + randFn() * (maxSec - minSec);
  if (duration > 0) {
    sleepFn(duration);
  }
  return duration;
};

export const paceIteration = (
  iterationStartMs: number,
  targetIntervalMs: number,
  sleepFn: (seconds: number) => void = sleep,
  nowFn: () => number = () => Date.now()
): number => {
  const elapsedMs = Math.max(0, nowFn() - iterationStartMs);
  const remainingMs = targetIntervalMs - elapsedMs;
  if (remainingMs > 0) {
    const sleepSec = remainingMs / 1000;
    sleepFn(sleepSec);
    return sleepSec;
  }
  return 0;
};
