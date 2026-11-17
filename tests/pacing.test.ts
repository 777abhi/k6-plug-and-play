import { describe, it, expect, vi } from 'vitest';

vi.mock('k6', () => ({ sleep: vi.fn() }));

import { paceIteration, randomSleep } from '../src/libs/pacing.js';

describe('pacing helpers', () => {
  it('randomSleep sleeps within [minSec, maxSec]', () => {
    const sleepFn = vi.fn();
    const duration = randomSleep(1, 3, sleepFn, () => 0.5);
    expect(duration).toBe(2);
    expect(sleepFn).toHaveBeenCalledWith(2);
  });

  it('randomSleep throws on invalid bounds', () => {
    expect(() => randomSleep(3, 1, vi.fn())).toThrow(/Invalid sleep bounds/);
  });

  it('paceIteration sleeps only for remaining interval', () => {
    const sleepFn = vi.fn();
    const slept = paceIteration(1000, 2000, sleepFn, () => 1400);
    expect(slept).toBe(1.6);
    expect(sleepFn).toHaveBeenCalledWith(1.6);

    const noSleep = paceIteration(1000, 1000, sleepFn, () => 2500);
    expect(noSleep).toBe(0);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });
});
